import {
  isCivilDate,
  MAX_SAVINGS_MINOR_UNITS,
} from "../../savings/domain/Savings";

export class MonthEndError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "MonthEndError";
  }
}
export type Allocation = Readonly<{
  accountId: number;
  amountMinorUnits: number;
}>;
export type DecisionPlan = Readonly<{
  savings: readonly Allocation[];
  coverage: readonly Allocation[];
  exceptionalIncomeMinorUnits: number;
}>;
export type DecisionInput = DecisionPlan &
  Readonly<{
    expectedRevision: number;
    idempotencyKey: string;
  }>;
export const EMPTY_PLAN: DecisionPlan = {
  savings: [],
  coverage: [],
  exceptionalIncomeMinorUnits: 0,
};
const invalid = (): never => {
  throw new MonthEndError("INVALID_DECISION");
};
const integer = (
  value: unknown,
  min: number,
  max = MAX_SAVINGS_MINOR_UNITS
): value is number =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;

/** Full replacement, bounded allocations and integer cents only. */
export function normalizeDecision(value: unknown): DecisionInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  const row = value as Record<string, unknown>;
  if (
    Object.keys(row).some(
      (key) =>
        ![
          "savings",
          "coverage",
          "exceptionalIncomeMinorUnits",
          "expectedRevision",
          "idempotencyKey",
        ].includes(key)
    ) ||
    !integer(row.expectedRevision, 0, 2147483646) ||
    !integer(row.exceptionalIncomeMinorUnits, 0) ||
    typeof row.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9:_-]{8,100}$/.test(row.idempotencyKey)
  )
    return invalid();
  const allocations = (entries: unknown): Allocation[] => {
    if (!Array.isArray(entries) || entries.length > 100) return invalid();
    const ids = new Set<number>();
    return entries
      .map((entry: unknown) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry))
          return invalid();
        const item = entry as Record<string, unknown>;
        if (
          Object.keys(item).length !== 2 ||
          !integer(item.accountId, 1, 2147483647) ||
          !integer(item.amountMinorUnits, 1) ||
          ids.has(item.accountId)
        )
          return invalid();
        ids.add(item.accountId);
        return {
          accountId: item.accountId,
          amountMinorUnits: item.amountMinorUnits,
        };
      })
      .sort((a, b) => a.accountId - b.accountId);
  };
  return {
    savings: allocations(row.savings),
    coverage: allocations(row.coverage),
    exceptionalIncomeMinorUnits: row.exceptionalIncomeMinorUnits,
    expectedRevision: row.expectedRevision,
    idempotencyKey: row.idempotencyKey,
  };
}
export function totals(plan: DecisionPlan) {
  return {
    savingsMinorUnits: plan.savings.reduce(
      (sum, row) => sum + row.amountMinorUnits,
      0
    ),
    coverageMinorUnits: plan.coverage.reduce(
      (sum, row) => sum + row.amountMinorUnits,
      0
    ),
    exceptionalIncomeMinorUnits: plan.exceptionalIncomeMinorUnits,
  };
}
export function evaluateDecision(result: number, plan: DecisionPlan) {
  if (!Number.isSafeInteger(result)) throw new MonthEndError("INVALID_RESULT");
  const amounts = totals(plan);
  if (
    (result >= 0 &&
      (amounts.coverageMinorUnits > 0 ||
        amounts.exceptionalIncomeMinorUnits > 0)) ||
    (result <= 0 && amounts.savingsMinorUnits > 0)
  )
    throw new MonthEndError("INVALID_ALLOCATION");
  if (
    amounts.savingsMinorUnits > Math.max(0, result) ||
    amounts.coverageMinorUnits + amounts.exceptionalIncomeMinorUnits >
      Math.max(0, -result) ||
    Object.values(amounts).some((amount) => amount > MAX_SAVINGS_MINOR_UNITS)
  )
    throw new MonthEndError("ALLOCATION_EXCEEDS_RESULT");
  return {
    ...amounts,
    carryMinorUnits:
      result -
      amounts.savingsMinorUnits +
      amounts.coverageMinorUnits +
      amounts.exceptionalIncomeMinorUnits,
  };
}
export type TransferAdjustment = Readonly<{
  accountId: number;
  direction: "TO_SAVINGS" | "FROM_SAVINGS";
  amountMinorUnits: number;
  reason: "MONTH_END" | "NEGATIVE_COVERAGE";
  isCompensation: boolean;
}>;
/** Change only the allocation delta; a replay or unchanged allocation moves no money. */
export function transferAdjustments(
  previous: DecisionPlan,
  next: DecisionPlan
): TransferAdjustment[] {
  const result: TransferAdjustment[] = [];
  for (const key of ["savings", "coverage"] as const) {
    const before = new Map(
      previous[key].map((row) => [row.accountId, row.amountMinorUnits])
    );
    const after = new Map(
      next[key].map((row) => [row.accountId, row.amountMinorUnits])
    );
    for (const accountId of [
      ...new Set([...before.keys(), ...after.keys()]),
    ].sort((a, b) => a - b)) {
      const delta = (after.get(accountId) ?? 0) - (before.get(accountId) ?? 0);
      if (delta === 0) continue;
      result.push({
        accountId,
        direction:
          (key === "savings") === delta > 0 ? "TO_SAVINGS" : "FROM_SAVINGS",
        amountMinorUnits: Math.abs(delta),
        reason: key === "savings" ? "MONTH_END" : "NEGATIVE_COVERAGE",
        isCompensation: delta < 0,
      });
    }
  }
  return result;
}
export function assertDecisionPeriod(
  month: string,
  currency: string,
  today: string
) {
  if (
    !/^\d{4}-\d{2}$/.test(month) ||
    !isCivilDate(`${month}-01`) ||
    month < "1000-01"
  )
    throw new MonthEndError("INVALID_MONTH");
  if (!/^[A-Z]{3}$/.test(currency)) throw new MonthEndError("INVALID_CURRENCY");
  if (month >= today.slice(0, 7)) throw new MonthEndError("PERIOD_NOT_CLOSED");
}
export function decisionView(
  month: string,
  currency: string,
  carryMinorUnits: number,
  row?: {
    revision: number;
    referenceResultMinorUnits: number | bigint;
    savingsMinorUnits: number | bigint;
    coverageMinorUnits: number | bigint;
    exceptionalIncomeMinorUnits: number | bigint;
    allocations: unknown;
  }
) {
  const plan = row ? (row.allocations as DecisionPlan) : EMPTY_PLAN;
  const amounts = totals(plan);
  const resultBeforeDecisionMinorUnits =
    carryMinorUnits +
    amounts.savingsMinorUnits -
    amounts.coverageMinorUnits -
    amounts.exceptionalIncomeMinorUnits;
  const correctionDeltaMinorUnits = row
    ? resultBeforeDecisionMinorUnits - Number(row.referenceResultMinorUnits)
    : 0;
  return {
    month,
    currency,
    status: row ? ("DECIDED" as const) : ("PENDING" as const),
    revision: row?.revision ?? 0,
    ...plan,
    ...amounts,
    resultBeforeDecisionMinorUnits,
    referenceResultMinorUnits: row
      ? Number(row.referenceResultMinorUnits)
      : resultBeforeDecisionMinorUnits,
    carryMinorUnits,
    requiresReview: correctionDeltaMinorUnits !== 0,
    correctionDeltaMinorUnits,
  };
}
export type DecisionView = ReturnType<typeof decisionView>;
