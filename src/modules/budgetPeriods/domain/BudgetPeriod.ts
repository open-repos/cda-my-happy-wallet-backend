export type BudgetMovementKind = "DEPENSE" | "ENTREE";

export type BudgetMovement = Readonly<{
  operationDate: string;
  minorUnits: number;
  kind: BudgetMovementKind;
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
  actualIncomeMinorUnits: number;
  actualExpenseMinorUnits: number;
  realRemainingMinorUnits: number;
  balanceStatus: BudgetBalanceStatus;
  remainingDays: number;
  realDailyAllowanceMinorUnits: number | null;
  days: readonly DailyBudgetPoint[];
}>;

export type CalculateRealBudgetInput = Readonly<{
  month: string;
  currency: string;
  today: string;
  fixedIncomeMinorUnits: number;
  fixedExpenseMinorUnits: number;
  movements: readonly BudgetMovement[];
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

  const byDate = new Map<
    string,
    { incomeMinorUnits: number; expenseMinorUnits: number }
  >();
  let actualIncomeMinorUnits = 0;
  let actualExpenseMinorUnits = 0;
  for (const movement of input.movements) {
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
  }

  const baseMinorUnits =
    input.fixedIncomeMinorUnits - input.fixedExpenseMinorUnits;
  let runningMinorUnits = baseMinorUnits;
  const days: DailyBudgetPoint[] = [];
  for (let day = 1; day <= bounds.days; day += 1) {
    const date = dateOf(input.month, day);
    const totals = byDate.get(date) ?? {
      incomeMinorUnits: 0,
      expenseMinorUnits: 0,
    };
    runningMinorUnits += totals.incomeMinorUnits - totals.expenseMinorUnits;
    if (!Number.isSafeInteger(runningMinorUnits)) {
      throw new BudgetPeriodError("INVALID_AMOUNT");
    }
    days.push({ date, ...totals, realRemainingMinorUnits: runningMinorUnits });
  }

  const realRemainingMinorUnits =
    baseMinorUnits + actualIncomeMinorUnits - actualExpenseMinorUnits;
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
    actualIncomeMinorUnits,
    actualExpenseMinorUnits,
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
    days,
  };
};
