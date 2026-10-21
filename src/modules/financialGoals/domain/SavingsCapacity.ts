import { FinancialGoal } from "./FinancialGoal";
import { BudgetPeriodError } from "../../budgetPeriods/domain/BudgetPeriod";

const safe = (amount: number): number => {
  if (!Number.isSafeInteger(amount))
    throw new BudgetPeriodError("INVALID_AMOUNT");
  return amount;
};

/** Keep existing goal forecasts: missing/past deadlines have no known required payment. */
export const calculateSavingsEffort = (
  goals: readonly FinancialGoal[],
  today: string
) => {
  const items = goals
    .filter((goal) => goal.savedMinorUnits < goal.targetMinorUnits)
    .map((goal) => {
      const forecast = goal.forecast(today);
      const required = forecast.requiredMonthlyMinorUnits;
      return {
        id: goal.id,
        title: goal.title,
        targetDate: goal.targetDate,
        plannedMinorUnits: goal.monthlyContributionMinorUnits,
        requiredMinorUnits: required,
        gapMinorUnits:
          required === null
            ? null
            : safe(required - goal.monthlyContributionMinorUnits),
        includedInTotals: goal.monthlyContributionMinorUnits > 0,
        status: forecast.status,
      };
    });
  let plannedMinorUnits = 0;
  let knownRequired = 0;
  let unassessableCount = 0;
  for (const item of items) {
    if (!item.includedInTotals) continue;
    plannedMinorUnits = safe(plannedMinorUnits + item.plannedMinorUnits);
    if (item.requiredMinorUnits === null) unassessableCount += 1;
    else knownRequired = safe(knownRequired + item.requiredMinorUnits);
  }
  return {
    goals: items,
    plannedMinorUnits,
    requiredMinorUnits: unassessableCount > 0 ? null : knownRequired,
    unassessableCount,
  };
};

export type SavingsSustainability =
  | "TENABLE"
  | "TENDU"
  | "NON_TENABLE"
  | "INDETERMINE";

/** Compare independent cumulative scenarios, keeping negative balances visible. */
export const calculateSavingsBalance = (
  beforeGoalsMinorUnits: number,
  plannedMinorUnits: number,
  requiredMinorUnits: number | null,
  elapsedMonths: number
) => {
  safe(beforeGoalsMinorUnits);
  safe(plannedMinorUnits);
  safe(elapsedMonths);
  if (
    plannedMinorUnits < 0 ||
    elapsedMonths < 1 ||
    (requiredMinorUnits !== null && safe(requiredMinorUnits) < 0)
  ) {
    throw new BudgetPeriodError("INVALID_AMOUNT");
  }
  const afterPlannedMinorUnits = safe(
    beforeGoalsMinorUnits - safe(plannedMinorUnits * elapsedMonths)
  );
  const afterRequiredMinorUnits =
    requiredMinorUnits === null
      ? null
      : safe(beforeGoalsMinorUnits - safe(requiredMinorUnits * elapsedMonths));
  const sustainability: SavingsSustainability =
    afterPlannedMinorUnits < 0 ||
    (afterRequiredMinorUnits !== null && afterRequiredMinorUnits < 0)
      ? "NON_TENABLE"
      : afterRequiredMinorUnits === null
      ? "INDETERMINE"
      : afterPlannedMinorUnits === 0 || afterRequiredMinorUnits === 0
      ? "TENDU"
      : "TENABLE";
  return {
    beforeGoalsMinorUnits,
    afterPlannedMinorUnits,
    afterRequiredMinorUnits,
    sustainability,
  };
};
