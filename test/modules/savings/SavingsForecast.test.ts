import assert from "assert";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain/FinancialGoal";
import { calculateSavingsTrajectory } from "../../../src/modules/financialGoals/domain/SavingsTrajectory";
import { SavingsCapacityService } from "../../../src/modules/financialGoals/application/SavingsCapacityService";
import { MonthlyBudgetForecast } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";

const goal = FinancialGoal.create({
  id: 1,
  ownerId: 7,
  title: "Projet",
  targetAmount: "1000",
  savedAmount: "100",
  monthlyContribution: "50",
  currency: "EUR",
  targetDate: "2027-12-01",
});
const assumptions = {
  currentRemainingVariableExpense: 0,
  futureAdditionalVariableExpense: 0,
  monthlySafetyMargin: 0,
};
const legacy = ["2026-11", "2026-12", "2027-01"].map((month, index) => ({
  month,
  forecastResultMinorUnits: 15000,
  forecastRemainingMinorUnits: 15000 * (index + 1),
  goalSavingsMinorUnits: 5000,
}));
const linked = legacy.map((row) => ({
  ...row,
  goalSavingsMinorUnits: 0,
  plannedSavingsMinorUnits: 5000,
}));
for (const mode of ["planned", "maximum", "reasonable"] as const)
  assert.deepEqual(
    calculateSavingsTrajectory([goal], 1, linked, assumptions, mode),
    calculateSavingsTrajectory([goal], 1, legacy, assumptions, mode)
  );

async function run() {
  const projected = linked.map(
    (row, index): MonthlyBudgetForecast => ({
      ...row,
      cumulativeSavingsReserveMinorUnits: 5000 * (index + 1),
      fixedIncomeMinorUnits: 20000,
      fixedExpenseMinorUnits: 0,
      baseMinorUnits: 20000,
      carryInMinorUnits: index * 15000,
      plannedIncomeMinorUnits: 0,
      plannedExpenseMinorUnits: 5000,
      remainingDays: 30,
      prudentDailyAllowanceMinorUnits: 500,
      prudentWeeklyAllowanceMinorUnits: 3500,
      prudentMonthlyAllowanceMinorUnits: row.forecastRemainingMinorUnits,
    })
  );
  const result = await new SavingsCapacityService(
    {
      forecast: async () => ({
        from: "2026-11",
        currency: "EUR",
        referenceDate: "2026-11-07",
        currentRealRemainingMinorUnits: 20000,
        months: projected,
      }),
    },
    { listForSavingsCapacity: async () => [goal] }
  ).calculate(7, "2026-11", 3, "EUR", "2026-11-07");
  assert.deepEqual(
    result.months.map((row) => row.beforeGoalsMinorUnits),
    [20000, 40000, 60000]
  );
  assert.deepEqual(
    result.months.map((row) => row.afterPlannedMinorUnits),
    [15000, 30000, 45000]
  );
  console.log(
    "Linked savings capacity and trajectory avoid double reservation"
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
