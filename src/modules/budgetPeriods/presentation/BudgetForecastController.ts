import { Request, Response } from "express";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { BudgetForecastService } from "../application/BudgetForecastService";
import { parseForecastRequest } from "./budgetPeriodValidators";

const amountOf = (value: number): string => (value / 100).toFixed(2);

export class BudgetForecastController {
  public constructor(
    private readonly service: BudgetForecastService,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async forecast(req: Request, res: Response): Promise<Response> {
    const query = parseForecastRequest(req.query);
    const result = await this.service.forecast(
      Number(getAuthenticatedUserId(req)),
      query.from,
      query.months,
      query.currency,
      this.today(),
      query.scenario
    );
    return res.status(200).json({
      data: {
        from: result.from,
        currency: result.currency,
        referenceDate: result.referenceDate,
        currentRealRemaining: amountOf(result.currentRealRemainingMinorUnits),
        months: result.months.map((month) => ({
          month: month.month,
          fixedIncome: amountOf(month.fixedIncomeMinorUnits),
          fixedExpense: amountOf(month.fixedExpenseMinorUnits),
          base: amountOf(month.baseMinorUnits),
          carryIn: amountOf(month.carryInMinorUnits),
          plannedIncome: amountOf(month.plannedIncomeMinorUnits),
          plannedExpense: amountOf(month.plannedExpenseMinorUnits),
          goalSavings: amountOf(month.goalSavingsMinorUnits),
          ...(month.envelopeReserveMinorUnits === undefined
            ? {}
            : { envelopeReserve: amountOf(month.envelopeReserveMinorUnits) }),
          ...(month.reconciliationAdjustmentMinorUnits === undefined
            ? {}
            : {
                reconciliationAdjustment: amountOf(
                  month.reconciliationAdjustmentMinorUnits
                ),
              }),
          forecastResult: amountOf(month.forecastResultMinorUnits),
          forecastRemaining: amountOf(month.forecastRemainingMinorUnits),
          remainingDays: month.remainingDays,
          prudentDailyAllowance: amountOf(
            month.prudentDailyAllowanceMinorUnits
          ),
          prudentWeeklyAllowance: amountOf(
            month.prudentWeeklyAllowanceMinorUnits
          ),
          prudentMonthlyAllowance: amountOf(
            month.prudentMonthlyAllowanceMinorUnits
          ),
        })),
      },
    });
  }
}
