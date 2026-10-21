import { BudgetForecastService } from "../../budgetPeriods/application/BudgetForecastService";
import { BudgetPeriodError } from "../../budgetPeriods/domain";
import { FinancialGoal } from "../domain";
import {
  calculateSavingsBalance,
  calculateSavingsEffort,
} from "../domain/SavingsCapacity";

export interface SavingsGoalReader {
  listForSavingsCapacity(
    ownerId: number,
    currency: string
  ): Promise<readonly FinancialGoal[]>;
}

export class SavingsCapacityService {
  public constructor(
    private readonly forecast: Pick<BudgetForecastService, "forecast">,
    private readonly goals: SavingsGoalReader
  ) {}

  public async calculate(
    ownerId: number,
    from: string,
    months: number,
    currency: string,
    today: string,
    scenario: import("../../monthlyEvents/domain").BudgetScenario = "standard"
  ) {
    const forecast = await this.forecast.forecast(
      ownerId,
      from,
      months,
      currency,
      today,
      scenario
    );
    const goals = await this.goals.listForSavingsCapacity(
      ownerId,
      forecast.currency
    );
    const effort = calculateSavingsEffort(
      goals.filter(
        (goal) =>
          goal.ownerId === ownerId && goal.currency === forecast.currency
      ),
      today
    );
    const currentIndex =
      Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7));
    return {
      from: forecast.from,
      currency: forecast.currency,
      referenceDate: today,
      goals: effort.goals,
      totalPlannedMinorUnits: effort.plannedMinorUnits,
      totalRequiredMinorUnits: effort.requiredMinorUnits,
      unassessableCount: effort.unassessableCount,
      months: forecast.months.map((month) => {
        const elapsed =
          Number(month.month.slice(0, 4)) * 12 +
          Number(month.month.slice(5, 7)) -
          currentIndex +
          1;
        // Forecast savings are a frozen monthly snapshot. Undo all elapsed
        // reservations before comparing the independent required-payment scenario.
        const reserved = month.goalSavingsMinorUnits * elapsed;
        const before = month.forecastRemainingMinorUnits + reserved;
        if (!Number.isSafeInteger(reserved) || !Number.isSafeInteger(before))
          throw new BudgetPeriodError("INVALID_AMOUNT");
        return {
          month: month.month,
          ...calculateSavingsBalance(
            before,
            effort.plannedMinorUnits,
            effort.requiredMinorUnits,
            elapsed
          ),
        };
      }),
    };
  }
}
