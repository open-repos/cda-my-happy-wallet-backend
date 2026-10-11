import { Request, Response } from "express";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import {
  BudgetPeriodEngine,
  BudgetPeriodRepository,
  BudgetPeriodState,
} from "../application";
import { ForecastBudgetSummary, RealBudgetSummary } from "../domain";
import {
  parseHistoryRequest,
  parseSummaryRequest,
} from "./budgetPeriodValidators";

const amountOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);
const optionalAmountOf = (minorUnits: number | null): string | null =>
  minorUnits === null ? null : amountOf(minorUnits);

export class BudgetPeriodController {
  public constructor(
    private readonly engine: BudgetPeriodEngine,
    private readonly periods: Pick<BudgetPeriodRepository, "listClosed">,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async summary(req: Request, res: Response): Promise<Response> {
    const query = parseSummaryRequest(req.params.month, req.query);
    const result = await this.engine.summarize(
      this.ownerId(req),
      query.month,
      query.currency,
      this.today()
    );
    return res.status(200).json({
      data: this.summaryDto(
        result.period,
        result.budget,
        result.forecast,
        result.carryFromMonth
      ),
    });
  }

  public async history(req: Request, res: Response): Promise<Response> {
    const query = parseHistoryRequest(req.query);
    const page = await this.periods.listClosed(
      this.ownerId(req),
      query.currency,
      query.pagination
    );
    return res
      .status(200)
      .json({ data: page.data.map(this.historyDto), meta: page.meta });
  }

  private ownerId(req: Request): number {
    return Number(getAuthenticatedUserId(req));
  }

  private summaryDto(
    period: BudgetPeriodState,
    budget: RealBudgetSummary,
    forecast: ForecastBudgetSummary | null,
    carryFromMonth: string | null
  ) {
    return {
      month: budget.month,
      currency: budget.currency,
      status: period.status,
      revision: period.revision,
      correctedAt: period.correctedAt?.toISOString() ?? null,
      balanceStatus: budget.balanceStatus,
      fixedIncome: amountOf(budget.fixedIncomeMinorUnits),
      fixedExpense: amountOf(budget.fixedExpenseMinorUnits),
      base: amountOf(budget.baseMinorUnits),
      carryIn: amountOf(budget.carryInMinorUnits),
      carryFromMonth,
      actualIncome: amountOf(budget.actualIncomeMinorUnits),
      actualExpense: amountOf(budget.actualExpenseMinorUnits),
      monthResult: amountOf(budget.monthResultMinorUnits),
      realRemaining: amountOf(budget.realRemainingMinorUnits),
      remainingDays: budget.remainingDays,
      realDailyAllowance: optionalAmountOf(budget.realDailyAllowanceMinorUnits),
      unresolvedEvents:
        period.status === "CLOSED"
          ? period.unresolvedEvents
          : forecast?.unresolvedCount ?? 0,
      forecast:
        forecast === null
          ? null
          : {
              plannedIncome: amountOf(forecast.plannedIncomeMinorUnits),
              plannedExpense: amountOf(forecast.plannedExpenseMinorUnits),
              goalSavings: amountOf(forecast.goalSavingsMinorUnits),
              forecastRemaining: amountOf(forecast.forecastRemainingMinorUnits),
              prudentDailyAllowance: optionalAmountOf(
                forecast.prudentDailyAllowanceMinorUnits
              ),
              unresolvedCount: forecast.unresolvedCount,
              overdueCount: forecast.overdueCount,
            },
      days: budget.days.map((day, index) => {
        const planned = forecast?.days[index];
        return {
          date: day.date,
          income: amountOf(day.incomeMinorUnits),
          expense: amountOf(day.expenseMinorUnits),
          realRemaining: amountOf(day.realRemainingMinorUnits),
          plannedIncome: planned
            ? amountOf(planned.plannedIncomeMinorUnits)
            : null,
          plannedExpense: planned
            ? amountOf(planned.plannedExpenseMinorUnits)
            : null,
          plannedCount: planned?.plannedCount ?? null,
          forecastRemaining: planned
            ? amountOf(planned.forecastRemainingMinorUnits)
            : null,
        };
      }),
    };
  }

  private readonly historyDto = (period: BudgetPeriodState) => ({
    month: period.month,
    currency: period.currency,
    base: amountOf(
      period.fixedIncomeMinorUnits - period.fixedExpenseMinorUnits
    ),
    carryIn: amountOf(period.carryInMinorUnits),
    actualIncome: amountOf(period.actualIncomeMinorUnits),
    actualExpense: amountOf(period.actualExpenseMinorUnits),
    monthResult: amountOf(
      period.realRemainingMinorUnits - period.carryInMinorUnits
    ),
    realRemaining: amountOf(period.realRemainingMinorUnits),
    balanceStatus:
      period.realRemainingMinorUnits === 0
        ? "BALANCED"
        : period.realRemainingMinorUnits > 0
        ? "POSITIVE"
        : "NEGATIVE",
    unresolvedEvents: period.unresolvedEvents,
    revision: period.revision,
    closedAt: period.closedAt?.toISOString() ?? null,
    correctedAt: period.correctedAt?.toISOString() ?? null,
  });
}
