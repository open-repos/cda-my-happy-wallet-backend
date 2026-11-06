import {
  BudgetMovementKind,
  BudgetPeriodError,
  RealBudgetSummary,
} from "./BudgetPeriod";

/** Occurrences planifiées non résolues, agrégées par date et sens. */
export type PlannedMovement = Readonly<{
  occurrenceDate: string;
  kind: BudgetMovementKind;
  minorUnits: number;
  count: number;
}>;

export type DailyForecastPoint = Readonly<{
  date: string;
  plannedIncomeMinorUnits: number;
  plannedExpenseMinorUnits: number;
  plannedCount: number;
  forecastRemainingMinorUnits: number;
  /**
   * Reste à vivre cumulé du jour (#179) : part du reste à vivre de base acquise
   * au prorata des jours, moins les dépenses et plus les entrées jusqu'à ce
   * jour, opérations saisies et événements prévus confondus.
   */
  dailyRemainingMinorUnits: number;
}>;

export type ForecastBudgetSummary = Readonly<{
  plannedIncomeMinorUnits: number;
  plannedExpenseMinorUnits: number;
  goalSavingsMinorUnits: number;
  forecastRemainingMinorUnits: number;
  prudentDailyAllowanceMinorUnits: number | null;
  unresolvedCount: number;
  overdueCount: number;
  envelopeReserveMinorUnits?: number;
  days: readonly DailyForecastPoint[];
}>;

export type CalculateForecastBudgetInput = Readonly<{
  real: RealBudgetSummary;
  today: string;
  planned: readonly PlannedMovement[];
  goalSavingsMinorUnits: number;
  envelopeReserveMinorUnits?: number;
}>;

const assertSafe = (value: number): void => {
  if (!Number.isSafeInteger(value)) {
    throw new BudgetPeriodError("INVALID_AMOUNT");
  }
};

/**
 * Le prévisionnel part du reste réel, ajoute les entrées et retire les
 * dépenses planifiées non résolues du mois, puis réserve dès le premier jour
 * l'épargne mensuelle des objectifs actifs.
 */
export const calculateForecastBudget = (
  input: CalculateForecastBudgetInput
): ForecastBudgetSummary => {
  const { real } = input;
  const reserve = input.envelopeReserveMinorUnits ?? 0;
  if (!Number.isSafeInteger(reserve) || reserve < 0)
    throw new BudgetPeriodError("INVALID_AMOUNT");
  if (
    !Number.isSafeInteger(input.goalSavingsMinorUnits) ||
    input.goalSavingsMinorUnits < 0
  ) {
    throw new BudgetPeriodError("INVALID_AMOUNT");
  }
  const start = real.days[0]?.date ?? `${real.month}-01`;
  const end = real.days[real.days.length - 1]?.date ?? start;

  const byDate = new Map<
    string,
    { income: number; expense: number; count: number }
  >();
  let plannedIncomeMinorUnits = 0;
  let plannedExpenseMinorUnits = 0;
  let unresolvedCount = 0;
  let overdueCount = 0;
  for (const movement of input.planned) {
    if (
      !Number.isSafeInteger(movement.minorUnits) ||
      movement.minorUnits <= 0 ||
      !Number.isSafeInteger(movement.count) ||
      movement.count <= 0 ||
      (movement.kind !== "DEPENSE" && movement.kind !== "ENTREE")
    ) {
      throw new BudgetPeriodError("INVALID_AMOUNT");
    }
    if (movement.occurrenceDate < start || movement.occurrenceDate > end) {
      throw new BudgetPeriodError("MOVEMENT_OUTSIDE_PERIOD");
    }
    const totals = byDate.get(movement.occurrenceDate) ?? {
      income: 0,
      expense: 0,
      count: 0,
    };
    if (movement.kind === "ENTREE") {
      totals.income += movement.minorUnits;
      plannedIncomeMinorUnits += movement.minorUnits;
    } else {
      totals.expense += movement.minorUnits;
      plannedExpenseMinorUnits += movement.minorUnits;
    }
    totals.count += movement.count;
    unresolvedCount += movement.count;
    if (movement.occurrenceDate < input.today) overdueCount += movement.count;
    assertSafe(plannedIncomeMinorUnits);
    assertSafe(plannedExpenseMinorUnits);
    byDate.set(movement.occurrenceDate, totals);
  }

  let plannedRunning = -input.goalSavingsMinorUnits - reserve;
  let eventsRunning = 0;
  // Part du jour du reste à vivre de base (revenus fixes − charges fixes),
  // tronquée vers zéro ; le reste de la division est porté par le dernier
  // jour, qui égale ainsi la base. Ni report, ni épargne, ni réserve.
  const monthDays = real.days.length;
  const dailyShare =
    monthDays === 0 ? 0 : Math.trunc(real.baseMinorUnits / monthDays);
  const days = real.days.map((day, index) => {
    const totals = byDate.get(day.date) ?? { income: 0, expense: 0, count: 0 };
    plannedRunning += totals.income - totals.expense;
    eventsRunning += totals.income - totals.expense;
    const forecastRemainingMinorUnits =
      day.realRemainingMinorUnits + plannedRunning;
    assertSafe(forecastRemainingMinorUnits);
    const share =
      index === monthDays - 1 ? real.baseMinorUnits : dailyShare * (index + 1);
    // Effet cumulé des opérations saisies, rapprochements compris : le reste
    // réel du jour sans la base ni le report.
    const operations =
      day.realRemainingMinorUnits -
      real.baseMinorUnits -
      real.carryInMinorUnits;
    const dailyRemainingMinorUnits = share + operations + eventsRunning;
    assertSafe(dailyRemainingMinorUnits);
    return {
      date: day.date,
      plannedIncomeMinorUnits: totals.income,
      plannedExpenseMinorUnits: totals.expense,
      plannedCount: totals.count,
      forecastRemainingMinorUnits,
      dailyRemainingMinorUnits,
    };
  });

  const forecastRemainingMinorUnits =
    real.realRemainingMinorUnits +
    plannedIncomeMinorUnits -
    plannedExpenseMinorUnits -
    input.goalSavingsMinorUnits -
    reserve;
  assertSafe(forecastRemainingMinorUnits);

  return {
    plannedIncomeMinorUnits,
    plannedExpenseMinorUnits,
    goalSavingsMinorUnits: input.goalSavingsMinorUnits,
    forecastRemainingMinorUnits,
    prudentDailyAllowanceMinorUnits:
      real.remainingDays === 0
        ? null
        : Math.round(forecastRemainingMinorUnits / real.remainingDays),
    unresolvedCount,
    overdueCount,
    ...(reserve === 0 ? {} : { envelopeReserveMinorUnits: reserve }),
    days,
  };
};
