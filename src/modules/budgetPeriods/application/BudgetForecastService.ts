import {
  assertCivilDate,
  BudgetPeriodError,
  calculateForecastBudget,
  calculateRealBudget,
  monthBounds,
} from "../domain";
import { BudgetPeriodEngineError } from "./BudgetPeriodEngine";
import { BudgetPeriodRepository } from "./BudgetPeriodRepository";

/** Only reads are available: forecasting cannot open/close a period or resolve an event. */
export type BudgetForecastReads = Pick<
  BudgetPeriodRepository,
  | "find"
  | "firstActivityMonth"
  | "listFrom"
  | "fixedTotals"
  | "actualMovements"
  | "plannedMovements"
  | "hasReconciliationPlans"
  | "envelopeReserve"
  | "goalSavings"
  | "monthEndDecision"
  | "withOwnerLock"
>;

export type MonthlyBudgetForecast = Readonly<{
  month: string;
  plannedSavingsMinorUnits?: number;
  cumulativeSavingsReserveMinorUnits?: number;
  fixedIncomeMinorUnits: number;
  fixedExpenseMinorUnits: number;
  baseMinorUnits: number;
  carryInMinorUnits: number;
  plannedIncomeMinorUnits: number;
  plannedExpenseMinorUnits: number;
  goalSavingsMinorUnits: number;
  forecastResultMinorUnits: number;
  forecastRemainingMinorUnits: number;
  remainingDays: number;
  prudentDailyAllowanceMinorUnits: number;
  prudentWeeklyAllowanceMinorUnits: number;
  prudentMonthlyAllowanceMinorUnits: number;
  envelopeReserveMinorUnits?: number;
  reconciliationAdjustmentMinorUnits?: number;
}>;

const monthIndex = (month: string) =>
  Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
export type BudgetForecastResult = Readonly<{
  from: string;
  currency: string;
  referenceDate: string;
  currentRealRemainingMinorUnits: number;
  months: MonthlyBudgetForecast[];
  carryDecision?: import("../../monthEnd/domain/MonthEnd").DecisionView;
}>;
const shiftMonth = (month: string, offset: number): string => {
  const index = monthIndex(month) + offset;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(
    (index % 12) + 1
  ).padStart(2, "0")}`;
};

export class BudgetForecastService {
  public constructor(
    private readonly periods: BudgetForecastReads,
    private readonly ownerLocked = false
  ) {}

  public async forecast(
    ownerId: number,
    from: string,
    months: number,
    currency: string,
    today: string,
    scenario: import("../../monthlyEvents/domain").BudgetScenario = "standard"
  ): Promise<BudgetForecastResult> {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0)
      throw new BudgetPeriodEngineError("INVALID_OWNER_ID");
    assertCivilDate(today);
    monthBounds(from);
    const currentMonth = today.slice(0, 7);
    const offset = monthIndex(from) - monthIndex(currentMonth);
    if (
      !Number.isInteger(months) ||
      months < 1 ||
      months > 24 ||
      offset < 0 ||
      offset > 23
    ) {
      throw new BudgetPeriodError("INVALID_MONTH");
    }
    monthBounds(shiftMonth(from, months - 1));
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency))
      throw new BudgetPeriodError("INVALID_CURRENCY");
    if (!this.ownerLocked && this.periods.withOwnerLock) {
      return this.periods.withOwnerLock(ownerId, (periods) =>
        new BudgetForecastService(periods, true).forecast(
          ownerId,
          from,
          months,
          normalizedCurrency,
          today,
          scenario
        )
      );
    }
    const [fixed, savings, actual, carry] = await Promise.all([
      this.periods.fixedTotals(ownerId, normalizedCurrency, currentMonth),
      this.periods.goalSavings(ownerId, normalizedCurrency),
      this.periods.actualMovements(ownerId, currentMonth, normalizedCurrency),
      this.currentCarry(ownerId, currentMonth, normalizedCurrency, today),
    ]);
    const current = calculateRealBudget({
      month: currentMonth,
      currency: normalizedCurrency,
      today,
      fixedIncomeMinorUnits: fixed.incomeMinorUnits,
      fixedExpenseMinorUnits: fixed.expenseMinorUnits,
      carryInMinorUnits: carry,
      movements: actual,
    });
    let remaining = current.realRemainingMinorUnits;
    const result: MonthlyBudgetForecast[] = [];
    let cumulativeSavingsReserveMinorUnits = 0;
    let hasLinkedSavings = false;
    // Project intervening months even when the requested window starts in the future.
    for (let index = 0; index < offset + months; index += 1) {
      const month = shiftMonth(currentMonth, index);
      const bounds = monthBounds(month);
      const carryInMinorUnits = remaining;
      const monthlyFixed =
        index === 0
          ? fixed
          : await this.periods.fixedTotals(ownerId, normalizedCurrency, month);
      const real =
        index === 0
          ? current
          : calculateRealBudget({
              month,
              currency: normalizedCurrency,
              today: bounds.start,
              fixedIncomeMinorUnits: monthlyFixed.incomeMinorUnits,
              fixedExpenseMinorUnits: monthlyFixed.expenseMinorUnits,
              carryInMinorUnits,
              movements: (
                await this.periods.actualMovements(
                  ownerId,
                  month,
                  normalizedCurrency
                )
              ).filter(
                (movement) => movement.fixedReconciliation !== undefined
              ),
            });
      const planned = await this.periods.plannedMovements(
        ownerId,
        month,
        normalizedCurrency,
        scenario
      );
      const plannedSavingsMinorUnits = planned.reduce(
        (total, row) => total + (row.savingsMinorUnits ?? 0),
        0
      );
      cumulativeSavingsReserveMinorUnits += savings + plannedSavingsMinorUnits;
      hasLinkedSavings ||= plannedSavingsMinorUnits > 0;
      if (
        hasLinkedSavings &&
        (!Number.isSafeInteger(plannedSavingsMinorUnits) ||
          !Number.isSafeInteger(cumulativeSavingsReserveMinorUnits))
      )
        throw new BudgetPeriodError("INVALID_AMOUNT");
      const forecast = calculateForecastBudget({
        real,
        today: index === 0 ? today : bounds.start,
        planned,
        goalSavingsMinorUnits: savings,
        envelopeReserveMinorUnits:
          (await this.periods.envelopeReserve?.(
            ownerId,
            month,
            normalizedCurrency
          )) ?? 0,
      });
      remaining = forecast.forecastRemainingMinorUnits;
      const forecastResultMinorUnits = remaining - carryInMinorUnits;
      if (!Number.isSafeInteger(forecastResultMinorUnits))
        throw new BudgetPeriodError("INVALID_AMOUNT");
      if (index >= offset)
        result.push({
          month,
          fixedIncomeMinorUnits: monthlyFixed.incomeMinorUnits,
          fixedExpenseMinorUnits: monthlyFixed.expenseMinorUnits,
          baseMinorUnits: real.baseMinorUnits,
          carryInMinorUnits,
          plannedIncomeMinorUnits: forecast.plannedIncomeMinorUnits,
          plannedExpenseMinorUnits: forecast.plannedExpenseMinorUnits,
          goalSavingsMinorUnits: savings,
          ...(hasLinkedSavings
            ? { plannedSavingsMinorUnits, cumulativeSavingsReserveMinorUnits }
            : {}),
          forecastResultMinorUnits,
          forecastRemainingMinorUnits: remaining,
          remainingDays: real.remainingDays,
          prudentDailyAllowanceMinorUnits: Math.round(
            remaining / real.remainingDays
          ),
          prudentWeeklyAllowanceMinorUnits:
            Math.trunc(remaining / real.remainingDays) *
              Math.min(7, real.remainingDays) +
            Math.round(
              ((remaining % real.remainingDays) *
                Math.min(7, real.remainingDays)) /
                real.remainingDays
            ),
          prudentMonthlyAllowanceMinorUnits: remaining,
          ...(forecast.envelopeReserveMinorUnits === undefined
            ? {}
            : {
                envelopeReserveMinorUnits: forecast.envelopeReserveMinorUnits,
              }),
          ...(real.reconciliationAdjustmentMinorUnits === undefined
            ? {}
            : {
                reconciliationAdjustmentMinorUnits:
                  real.reconciliationAdjustmentMinorUnits,
              }),
        });
    }
    const carryDecision = await this.periods.monthEndDecision?.(
      ownerId,
      shiftMonth(currentMonth, -1),
      normalizedCurrency,
      carry
    );
    return {
      from,
      currency: normalizedCurrency,
      referenceDate: today,
      currentRealRemainingMinorUnits: current.realRemainingMinorUnits,
      months: result,
      ...(carryDecision ? { carryDecision } : {}),
    };
  }

  private async currentCarry(
    owner: number,
    month: string,
    currency: string,
    today: string
  ): Promise<number> {
    const current = await this.periods.find(owner, month, currency);
    if (current != null) return current.carryInMinorUnits;
    const origin = await this.periods.firstActivityMonth(owner, currency);
    if (origin == null || origin >= month) return 0;
    const states = await this.periods.listFrom(owner, currency, origin);
    const previous = states.filter((p) => p.month < month);
    const latestClosed = previous.filter((p) => p.status === "CLOSED").at(-1);
    let cursor =
      latestClosed == null ? origin : shiftMonth(latestClosed.month, 1);
    let carry = latestClosed?.realRemainingMinorUnits ?? 0;
    let fixed =
      latestClosed == null
        ? await this.periods.fixedTotals(owner, currency, origin)
        : {
            incomeMinorUnits: latestClosed.fixedIncomeMinorUnits,
            expenseMinorUnits: latestClosed.fixedExpenseMinorUnits,
          };
    while (cursor < month) {
      const state = previous.find((p) => p.month === cursor);
      if (state != null)
        fixed = {
          incomeMinorUnits: state.fixedIncomeMinorUnits,
          expenseMinorUnits: state.fixedExpenseMinorUnits,
        };
      if (
        state == null &&
        (await this.periods.hasReconciliationPlans?.(owner, cursor, currency))
      ) {
        fixed = await this.periods.fixedTotals(owner, currency, cursor);
      }
      carry = calculateRealBudget({
        month: cursor,
        currency,
        today,
        fixedIncomeMinorUnits: fixed.incomeMinorUnits,
        fixedExpenseMinorUnits: fixed.expenseMinorUnits,
        carryInMinorUnits: carry,
        movements: await this.periods.actualMovements(owner, cursor, currency),
        ...(state?.status === "CLOSED"
          ? {
              frozenReconciliationAdjustmentMinorUnits:
                state.reconciliationAdjustmentMinorUnits ?? 0,
            }
          : {}),
      }).realRemainingMinorUnits;
      cursor = shiftMonth(cursor, 1);
    }
    return carry;
  }
}
