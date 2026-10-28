export type BudgetMovementKind = "DEPENSE" | "ENTREE";

export type BudgetMovement = Readonly<{
  operationDate: string;
  minorUnits: number;
  kind: BudgetMovementKind;
  fixedReconciliation?: Readonly<{
    occurrenceId: number;
    plannedMinorUnits: number;
  }>;
}>;

export type DailyBudgetPoint = Readonly<{
  date: string;
  incomeMinorUnits: number;
  expenseMinorUnits: number;
  realRemainingMinorUnits: number;
}>;

export type BudgetBalanceStatus = "POSITIVE" | "BALANCED" | "NEGATIVE";

export type RealBudgetSummary = Readonly<{
  month: string;
  currency: string;
  fixedIncomeMinorUnits: number;
  fixedExpenseMinorUnits: number;
  baseMinorUnits: number;
  /** Reste réel signé du mois précédent clôturé; 0 pour la première période. */
  carryInMinorUnits: number;
  actualIncomeMinorUnits: number;
  actualExpenseMinorUnits: number;
  /** Résultat propre au mois, hors report : socle + entrées − dépenses. */
  monthResultMinorUnits: number;
  realRemainingMinorUnits: number;
  balanceStatus: BudgetBalanceStatus;
  remainingDays: number;
  realDailyAllowanceMinorUnits: number | null;
  reconciliationAdjustmentMinorUnits?: number;
  days: readonly DailyBudgetPoint[];
}>;

export type CalculateRealBudgetInput = Readonly<{
  month: string;
  currency: string;
  today: string;
  fixedIncomeMinorUnits: number;
  fixedExpenseMinorUnits: number;
  carryInMinorUnits?: number;
  movements: readonly BudgetMovement[];
  closed?: boolean;
  frozenReconciliationAdjustmentMinorUnits?: number;
}>;

export type BudgetPeriodErrorCode =
  | "INVALID_MONTH"
  | "INVALID_DATE"
  | "INVALID_CURRENCY"
  | "INVALID_AMOUNT"
  | "MOVEMENT_OUTSIDE_PERIOD";

export class BudgetPeriodError extends Error {
  public constructor(public readonly code: BudgetPeriodErrorCode) {
    super(code);
    this.name = "BudgetPeriodError";
  }
}

const parseMonth = (value: string): readonly [number, number] => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (match == null) throw new BudgetPeriodError("INVALID_MONTH");
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1970 || month < 1 || month > 12) {
    throw new BudgetPeriodError("INVALID_MONTH");
  }
  return [year, month];
};

const parseDate = (value: string): readonly [number, number, number] => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match == null) throw new BudgetPeriodError("INVALID_DATE");
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (
    date.getUTCFullYear() !== parts[0] ||
    date.getUTCMonth() !== parts[1] - 1 ||
    date.getUTCDate() !== parts[2]
  ) {
    throw new BudgetPeriodError("INVALID_DATE");
  }
  return parts;
};

export const assertCivilDate = (value: string): void => {
  parseDate(value);
};

const assertMinorUnits = (value: number): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new BudgetPeriodError("INVALID_AMOUNT");
  }
};

const dateOf = (month: string, day: number): string =>
  `${month}-${String(day).padStart(2, "0")}`;

export const monthBounds = (
  month: string
): Readonly<{ start: string; end: string; days: number }> => {
  const [year, monthNumber] = parseMonth(month);
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: dateOf(month, days), days };
};

export const calculateRealBudget = (
  input: CalculateRealBudgetInput
): RealBudgetSummary => {
  const bounds = monthBounds(input.month);
  parseDate(input.today);
  if (!/^[A-Z]{3}$/.test(input.currency)) {
    throw new BudgetPeriodError("INVALID_CURRENCY");
  }
  assertMinorUnits(input.fixedIncomeMinorUnits);
  assertMinorUnits(input.fixedExpenseMinorUnits);
  const carryInMinorUnits = input.carryInMinorUnits ?? 0;
  if (!Number.isSafeInteger(carryInMinorUnits)) {
    throw new BudgetPeriodError("INVALID_AMOUNT");
  }

  const byDate = new Map<
    string,
    { incomeMinorUnits: number; expenseMinorUnits: number }
  >();
  let actualIncomeMinorUnits = 0;
  let actualExpenseMinorUnits = 0;
  const adjustmentsByDate = new Map<string, number>();
  const reconciled = new Map<
    number,
    { actual: number; planned: number; kind: BudgetMovementKind }
  >();
  let reconciliationAdjustmentMinorUnits = 0;
  const adjust = (date: string, amount: number) => {
    const total = (adjustmentsByDate.get(date) ?? 0) + amount;
    reconciliationAdjustmentMinorUnits += amount;
    if (
      !Number.isSafeInteger(total) ||
      !Number.isSafeInteger(reconciliationAdjustmentMinorUnits)
    )
      throw new BudgetPeriodError("INVALID_AMOUNT");
    adjustmentsByDate.set(date, total);
  };
  // Allocate the covered amount chronologically, independent of repository order.
  for (const movement of [...input.movements].sort((a, b) =>
    a.operationDate.localeCompare(b.operationDate)
  )) {
    parseDate(movement.operationDate);
    assertMinorUnits(movement.minorUnits);
    if (
      movement.minorUnits === 0 ||
      (movement.kind !== "DEPENSE" && movement.kind !== "ENTREE")
    ) {
      throw new BudgetPeriodError("INVALID_AMOUNT");
    }
    if (
      movement.operationDate < bounds.start ||
      movement.operationDate > bounds.end
    ) {
      throw new BudgetPeriodError("MOVEMENT_OUTSIDE_PERIOD");
    }
    const totals = byDate.get(movement.operationDate) ?? {
      incomeMinorUnits: 0,
      expenseMinorUnits: 0,
    };
    if (movement.kind === "ENTREE") {
      totals.incomeMinorUnits += movement.minorUnits;
      actualIncomeMinorUnits += movement.minorUnits;
    } else {
      totals.expenseMinorUnits += movement.minorUnits;
      actualExpenseMinorUnits += movement.minorUnits;
    }
    if (
      !Number.isSafeInteger(totals.incomeMinorUnits) ||
      !Number.isSafeInteger(totals.expenseMinorUnits) ||
      !Number.isSafeInteger(actualIncomeMinorUnits) ||
      !Number.isSafeInteger(actualExpenseMinorUnits)
    ) {
      throw new BudgetPeriodError("INVALID_AMOUNT");
    }
    byDate.set(movement.operationDate, totals);
    const link = movement.fixedReconciliation;
    if (link) {
      assertMinorUnits(link.plannedMinorUnits);
      if (!Number.isSafeInteger(link.occurrenceId) || link.occurrenceId <= 0)
        throw new BudgetPeriodError("INVALID_AMOUNT");
      const previous = reconciled.get(link.occurrenceId) ?? {
        actual: 0,
        planned: link.plannedMinorUnits,
        kind: movement.kind,
      };
      if (
        previous.planned !== link.plannedMinorUnits ||
        previous.kind !== movement.kind
      )
        throw new BudgetPeriodError("INVALID_AMOUNT");
      const coveredBefore = Math.min(previous.actual, previous.planned);
      previous.actual += movement.minorUnits;
      assertMinorUnits(previous.actual);
      const covered =
        Math.min(previous.actual, previous.planned) - coveredBefore;
      adjust(
        movement.operationDate,
        movement.kind === "DEPENSE" ? covered : -covered
      );
      reconciled.set(link.occurrenceId, previous);
    }
  }

  if (input.closed ?? input.month < input.today.slice(0, 7)) {
    // A known actual replaces its fixed plan at closure. Unmatched plans stay reserved.
    for (const group of reconciled.values()) {
      const unused = Math.max(group.planned - group.actual, 0);
      adjust(bounds.end, group.kind === "DEPENSE" ? unused : -unused);
    }
  }
  if (input.frozenReconciliationAdjustmentMinorUnits !== undefined) {
    if (!Number.isSafeInteger(input.frozenReconciliationAdjustmentMinorUnits))
      throw new BudgetPeriodError("INVALID_AMOUNT");
    adjust(
      bounds.end,
      input.frozenReconciliationAdjustmentMinorUnits -
        reconciliationAdjustmentMinorUnits
    );
  }
  const baseMinorUnits =
    input.fixedIncomeMinorUnits - input.fixedExpenseMinorUnits;
  let runningMinorUnits = baseMinorUnits + carryInMinorUnits;
  const days: DailyBudgetPoint[] = [];
  for (let day = 1; day <= bounds.days; day += 1) {
    const date = dateOf(input.month, day);
    const totals = byDate.get(date) ?? {
      incomeMinorUnits: 0,
      expenseMinorUnits: 0,
    };
    runningMinorUnits +=
      totals.incomeMinorUnits -
      totals.expenseMinorUnits +
      (adjustmentsByDate.get(date) ?? 0);
    if (!Number.isSafeInteger(runningMinorUnits)) {
      throw new BudgetPeriodError("INVALID_AMOUNT");
    }
    days.push({ date, ...totals, realRemainingMinorUnits: runningMinorUnits });
  }

  const monthResultMinorUnits =
    baseMinorUnits +
    actualIncomeMinorUnits -
    actualExpenseMinorUnits +
    reconciliationAdjustmentMinorUnits;
  const realRemainingMinorUnits = monthResultMinorUnits + carryInMinorUnits;
  const currentMonth = input.today.slice(0, 7);
  const remainingDays =
    currentMonth === input.month
      ? bounds.days - Number(input.today.slice(8, 10)) + 1
      : 0;

  return {
    month: input.month,
    currency: input.currency,
    fixedIncomeMinorUnits: input.fixedIncomeMinorUnits,
    fixedExpenseMinorUnits: input.fixedExpenseMinorUnits,
    baseMinorUnits,
    carryInMinorUnits,
    actualIncomeMinorUnits,
    actualExpenseMinorUnits,
    monthResultMinorUnits,
    realRemainingMinorUnits,
    balanceStatus:
      realRemainingMinorUnits === 0
        ? "BALANCED"
        : realRemainingMinorUnits > 0
        ? "POSITIVE"
        : "NEGATIVE",
    remainingDays,
    realDailyAllowanceMinorUnits:
      remainingDays === 0
        ? null
        : Math.round(realRemainingMinorUnits / remainingDays),
    ...(reconciled.size > 0 || reconciliationAdjustmentMinorUnits !== 0
      ? { reconciliationAdjustmentMinorUnits }
      : {}),
    days,
  };
};
