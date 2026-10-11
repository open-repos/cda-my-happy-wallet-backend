import {
  assertCivilDate,
  calculateRealBudget,
  monthBounds,
  RealBudgetSummary,
} from "../domain";
import {
  BudgetPeriodRepository,
  BudgetPeriodState,
} from "./BudgetPeriodRepository";

export type BudgetPeriodEngineErrorCode = "INVALID_OWNER_ID" | "FUTURE_PERIOD";

export class BudgetPeriodEngineError extends Error {
  public constructor(public readonly code: BudgetPeriodEngineErrorCode) {
    super(code);
    this.name = "BudgetPeriodEngineError";
  }
}

export type BudgetPeriodSummary = Readonly<{
  period: BudgetPeriodState;
  budget: RealBudgetSummary;
}>;

export class BudgetPeriodEngine {
  public constructor(private readonly periods: BudgetPeriodRepository) {}

  public async summarize(
    ownerId: number,
    month: string,
    currency: string,
    today: string
  ): Promise<BudgetPeriodSummary> {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      throw new BudgetPeriodEngineError("INVALID_OWNER_ID");
    }
    const normalizedCurrency = currency.trim().toUpperCase();
    monthBounds(month);
    assertCivilDate(today);
    const currentMonth = today.slice(0, 7);
    if (month > currentMonth) {
      throw new BudgetPeriodEngineError("FUTURE_PERIOD");
    }

    let period = await this.periods.find(ownerId, month, normalizedCurrency);
    if (period == null) {
      const fixed = await this.periods.fixedTotals(ownerId, normalizedCurrency);
      period = await this.periods.open(
        ownerId,
        month,
        normalizedCurrency,
        fixed.incomeMinorUnits,
        fixed.expenseMinorUnits
      );
    } else if (period.status === "OPEN" && month === currentMonth) {
      const fixed = await this.periods.fixedTotals(ownerId, normalizedCurrency);
      if (
        fixed.incomeMinorUnits !== period.fixedIncomeMinorUnits ||
        fixed.expenseMinorUnits !== period.fixedExpenseMinorUnits
      ) {
        period = await this.periods.updateOpenFixedSnapshot(
          period.id,
          ownerId,
          fixed.incomeMinorUnits,
          fixed.expenseMinorUnits
        );
      }
    }

    const movements = await this.periods.actualMovements(
      ownerId,
      month,
      normalizedCurrency
    );
    const budget = calculateRealBudget({
      month,
      currency: normalizedCurrency,
      today,
      fixedIncomeMinorUnits: period.fixedIncomeMinorUnits,
      fixedExpenseMinorUnits: period.fixedExpenseMinorUnits,
      movements,
    });

    if (period.status === "OPEN" && month < currentMonth) {
      period = await this.periods.close(period.id, ownerId, {
        actualIncomeMinorUnits: budget.actualIncomeMinorUnits,
        actualExpenseMinorUnits: budget.actualExpenseMinorUnits,
        realRemainingMinorUnits: budget.realRemainingMinorUnits,
      });
    }
    return { period, budget };
  }
}
