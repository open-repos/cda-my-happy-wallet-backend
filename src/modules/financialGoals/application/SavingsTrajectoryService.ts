import { FinancialGoal } from "../domain";
import { BudgetScenario } from "../../monthlyEvents/domain";
import { MonthlyBudgetForecast } from "../../budgetPeriods/application/BudgetForecastService";
import {
  calculateSavingsTrajectory,
  decimalMinor,
  TrajectoryAssumptions,
} from "../domain/SavingsTrajectory";
import { ErrorCode, ErrorException } from "../../../utils/errors";

export type SavingsTrajectoryRequest = TrajectoryAssumptions &
  Readonly<{
    currency: string;
    scenario: BudgetScenario;
    months: number;
    selectedGoalId: number;
  }>;
export interface SavingsTrajectorySnapshot {
  read(
    ownerId: number,
    request: SavingsTrajectoryRequest,
    today: string
  ): Promise<{
    goals: readonly FinancialGoal[];
    months: readonly MonthlyBudgetForecast[];
  }>;
}

export class SavingsTrajectoryService {
  public constructor(private readonly snapshots: SavingsTrajectorySnapshot) {}

  public async calculate(
    ownerId: number,
    request: SavingsTrajectoryRequest,
    today: string
  ) {
    const snapshot = await this.snapshots.read(ownerId, request, today);
    const goals = snapshot.goals.filter(
      (goal) => goal.ownerId === ownerId && goal.currency === request.currency
    );
    if (!goals.some((goal) => goal.id === request.selectedGoalId))
      throw new ErrorException(ErrorCode.NotFound);
    return {
      referenceDate: today,
      currency: request.currency,
      scenario: request.scenario,
      selectedGoalId: request.selectedGoalId,
      assumptions: {
        currentRemainingVariableExpense: decimalMinor(
          request.currentRemainingVariableExpense
        ),
        futureAdditionalVariableExpense: decimalMinor(
          request.futureAdditionalVariableExpense
        ),
        monthlySafetyMargin: decimalMinor(request.monthlySafetyMargin),
      },
      goals: goals.map((goal) => {
        const forecast = goal.forecast(today);
        return {
          id: goal.id,
          title: goal.title,
          targetAmount: decimalMinor(goal.targetMinorUnits),
          savedAmount: decimalMinor(goal.savedMinorUnits),
          remainingAmount: decimalMinor(forecast.remainingMinorUnits),
          monthlyContribution: decimalMinor(goal.monthlyContributionMinorUnits),
          targetDate: goal.targetDate,
          forecast: {
            referenceMonth: forecast.referenceMonth,
            status: forecast.status,
            contributionsNeeded: forecast.contributionsNeeded,
            estimatedReachMonth: forecast.estimatedReachMonth,
            requiredMonthlyContribution:
              forecast.requiredMonthlyMinorUnits === null
                ? null
                : decimalMinor(forecast.requiredMonthlyMinorUnits),
          },
        };
      }),
      projections: {
        planned: calculateSavingsTrajectory(
          goals,
          request.selectedGoalId,
          snapshot.months,
          request,
          "planned"
        ),
        maximum: calculateSavingsTrajectory(
          goals,
          request.selectedGoalId,
          snapshot.months,
          request,
          "maximum"
        ),
        reasonable: calculateSavingsTrajectory(
          goals,
          request.selectedGoalId,
          snapshot.months,
          request,
          "reasonable"
        ),
      },
    };
  }
}
