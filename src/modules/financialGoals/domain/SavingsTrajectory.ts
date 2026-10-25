import { BudgetPeriodError } from "../../budgetPeriods/domain";
import { FinancialGoal } from "./FinancialGoal";
export type SavingsTrajectoryMonth = Readonly<{
  month: string;
  forecastResultMinorUnits: number;
  forecastRemainingMinorUnits: number;
  goalSavingsMinorUnits: number;
}>;

export type TrajectoryAssumptions = Readonly<{
  currentRemainingVariableExpense: number;
  futureAdditionalVariableExpense: number;
  monthlySafetyMargin: number;
}>;

export const safeMinor = (value: number): number => {
  if (!Number.isSafeInteger(value))
    throw new BudgetPeriodError("INVALID_AMOUNT");
  return value;
};

/** Serialize integers without floating point rounding at the safe-integer limit. */
export const decimalMinor = (value: number): string => {
  safeMinor(value);
  const magnitude = Math.abs(value);
  return `${value < 0 ? "-" : ""}${Math.trunc(magnitude / 100)}.${String(
    magnitude % 100
  ).padStart(2, "0")}`;
};

export const calculateSavingsTrajectory = (
  goals: readonly FinancialGoal[],
  selectedGoalId: number,
  forecastMonths: readonly SavingsTrajectoryMonth[],
  assumptions: TrajectoryAssumptions,
  mode: "planned" | "maximum" | "reasonable"
) => {
  const selected = goals.find((goal) => goal.id === selectedGoalId);
  const first = forecastMonths[0];
  if (selected == null || first == null)
    throw new BudgetPeriodError("INVALID_AMOUNT");
  for (const amount of [
    assumptions.currentRemainingVariableExpense,
    assumptions.futureAdditionalVariableExpense,
    assumptions.monthlySafetyMargin,
  ])
    if (safeMinor(amount) < 0) throw new BudgetPeriodError("INVALID_AMOUNT");
  const committed = goals.map((goal) =>
    goal.savedMinorUnits < goal.targetMinorUnits
      ? goal.monthlyContributionMinorUnits
      : 0
  );
  const totalCommitted = committed.reduce(
    (sum, amount) => safeMinor(sum + amount),
    0
  );
  const selectedIndex = goals.indexOf(selected);
  const reasonable = mode === "reasonable";
  const currentVariable = reasonable
    ? assumptions.currentRemainingVariableExpense
    : 0;
  const margin = reasonable ? assumptions.monthlySafetyMargin : 0;
  // The current month is already net of real operations, unresolved events and reservations.
  let balance = safeMinor(first.forecastRemainingMinorUnits - currentVariable);
  let protectedBalance = safeMinor(
    Math.max(0, safeMinor(balance - margin)) + margin
  );
  const currentFundable = safeMinor(balance - protectedBalance) >= 0;
  const current = {
    month: first.month,
    serverRemaining: decimalMinor(first.forecastRemainingMinorUnits),
    reservedContributions: decimalMinor(first.goalSavingsMinorUnits),
    additionalVariableExpense: decimalMinor(currentVariable),
    safetyMargin: decimalMinor(margin),
    remainingUnderAssumptions: decimalMinor(safeMinor(balance - margin)),
    cashBalance: decimalMinor(balance),
    protectedBalance: decimalMinor(protectedBalance),
    fundable: currentFundable,
  };
  const accumulated = goals.map((goal) => goal.savedMinorUnits);
  const points = [
    {
      month: first.month,
      savedAmount: decimalMinor(selected.savedMinorUnits),
      kind: "DECLARED" as "DECLARED" | "PROJECTED",
      fundable: true,
    },
  ];
  let scheduledReachMonth: string | null =
    selected.savedMinorUnits >= selected.targetMinorUnits ? first.month : null;
  let estimatedReachMonth = scheduledReachMonth;
  let lastFundable = currentFundable;
  let anyContribution = false;
  const months = forecastMonths.slice(1).map((month) => {
    const carryIn = balance;
    // Extract this month's flow, never reuse a cumulative remaining balance as income.
    const knownFlow = safeMinor(
      month.forecastResultMinorUnits + month.goalSavingsMinorUnits
    );
    const beforeGoals = safeMinor(balance + knownFlow);
    const variable = reasonable
      ? assumptions.futureAdditionalVariableExpense
      : 0;
    protectedBalance = safeMinor(protectedBalance + margin);
    const afterPlanned = safeMinor(
      safeMinor(beforeGoals - variable) - totalCommitted
    );
    const free = safeMinor(afterPlanned - protectedBalance);
    const remaining = Math.max(
      0,
      selected.targetMinorUnits - accumulated[selectedIndex]
    );
    const extra =
      mode === "planned"
        ? 0
        : Math.min(
            Math.max(0, free),
            Math.max(0, remaining - committed[selectedIndex])
          );
    balance = safeMinor(afterPlanned - extra);
    const fundable = free >= 0;
    lastFundable = fundable;
    const allocations = goals.map((goal, index) => {
      const reserved = safeMinor(
        committed[index] + (index === selectedIndex ? extra : 0)
      );
      const contribution = Math.min(
        reserved,
        Math.max(0, goal.targetMinorUnits - accumulated[index])
      );
      accumulated[index] = safeMinor(accumulated[index] + contribution);
      return {
        goalId: goal.id,
        reservedContribution: decimalMinor(reserved),
        projectedContribution: decimalMinor(contribution),
        projectedSavedAmount: decimalMinor(accumulated[index]),
      };
    });
    anyContribution ||= accumulated[selectedIndex] > selected.savedMinorUnits;
    if (
      scheduledReachMonth === null &&
      accumulated[selectedIndex] >= selected.targetMinorUnits
    ) {
      scheduledReachMonth = month.month;
    }
    if (
      estimatedReachMonth === null &&
      accumulated[selectedIndex] >= selected.targetMinorUnits &&
      fundable
    ) {
      estimatedReachMonth = month.month;
    }
    points.push({
      month: month.month,
      savedAmount: decimalMinor(accumulated[selectedIndex]),
      kind: "PROJECTED",
      fundable,
    });
    return {
      month: month.month,
      knownFlowBeforeGoals: decimalMinor(knownFlow),
      carryIn: decimalMinor(carryIn),
      additionalVariableExpense: decimalMinor(variable),
      safetyMargin: decimalMinor(margin),
      capacityBeforeGoals: decimalMinor(
        safeMinor(safeMinor(beforeGoals - variable) - protectedBalance)
      ),
      existingReservedContributions: decimalMinor(totalCommitted),
      freeSupplement: decimalMinor(free),
      allocatedSupplement: decimalMinor(extra),
      selectedPossibleContribution: decimalMinor(
        Math.max(0, safeMinor(committed[selectedIndex] + free))
      ),
      totalPossibleContributions: decimalMinor(
        Math.max(0, safeMinor(totalCommitted + free))
      ),
      totalReservedContributions: decimalMinor(
        safeMinor(totalCommitted + extra)
      ),
      selectedTotalContribution:
        allocations[selectedIndex].projectedContribution,
      carryOut: decimalMinor(balance),
      protectedBalance: decimalMinor(protectedBalance),
      fundable,
      allocations,
    };
  });
  const reached = selected.savedMinorUnits >= selected.targetMinorUnits;
  const reachReason = reached
    ? "REACHED"
    : estimatedReachMonth !== null
    ? "PROJECTED"
    : !lastFundable
    ? "BUDGET_DEFICIT"
    : anyContribution || forecastMonths.length === 1
    ? "OUTSIDE_HORIZON"
    : "NO_CONTRIBUTION";
  return {
    current,
    points,
    months,
    scheduledReachMonth,
    estimatedReachMonth,
    reachReason,
  };
};
