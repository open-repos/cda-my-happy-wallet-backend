import { Request, Response } from "express";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { parseForecastRequest } from "../../budgetPeriods/presentation/budgetPeriodValidators";
import { SavingsCapacityService } from "../application/SavingsCapacityService";

const amountOf = (value: number): string => (value / 100).toFixed(2);
const optionalAmount = (value: number | null): string | null =>
  value === null ? null : amountOf(value);

export class SavingsCapacityController {
  public constructor(
    private readonly service: SavingsCapacityService,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async summary(req: Request, res: Response): Promise<Response> {
    const query = parseForecastRequest(req.query);
    const result = await this.service.calculate(
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
        totalPlannedMonthlyContribution: amountOf(
          result.totalPlannedMinorUnits
        ),
        totalRequiredMonthlyContribution: optionalAmount(
          result.totalRequiredMinorUnits
        ),
        unassessableCount: result.unassessableCount,
        goals: result.goals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          targetDate: goal.targetDate,
          plannedMonthlyContribution: amountOf(goal.plannedMinorUnits),
          requiredMonthlyContribution: optionalAmount(goal.requiredMinorUnits),
          monthlyContributionGap: optionalAmount(goal.gapMinorUnits),
          includedInTotals: goal.includedInTotals,
          status: goal.status,
        })),
        months: result.months.map((month) => ({
          month: month.month,
          beforeGoals: amountOf(month.beforeGoalsMinorUnits),
          afterPlanned: amountOf(month.afterPlannedMinorUnits),
          afterRequired: optionalAmount(month.afterRequiredMinorUnits),
          sustainability: month.sustainability,
        })),
      },
    });
  }
}
