import { Request, Response } from "express";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { BudgetForecastService } from "../application/BudgetForecastService";
import { parseSummaryRequest } from "./budgetPeriodValidators";

const amountOf = (value: number): string => (value / 100).toFixed(2);

export class BudgetForecastController {
  public constructor(
    private readonly service: BudgetForecastService,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async forecast(req: Request, res: Response): Promise<Response> {
    const { from, months, currency, ...unknown } = req.query;
    if (
      Object.keys(unknown).length > 0 ||
      typeof from !== "string" ||
      (months !== undefined &&
        (typeof months !== "string" || !/^(?:[1-9]|1\d|2[0-4])$/.test(months)))
    ) {
      throw new ErrorException(
        ErrorCode.ValidationFailed,
        "Forecast parameters are invalid"
      );
    }
    const query = parseSummaryRequest(from, { currency });
    const result = await this.service.forecast(
      Number(getAuthenticatedUserId(req)),
      query.month,
      months === undefined ? 12 : Number(months),
      query.currency,
      this.today()
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
