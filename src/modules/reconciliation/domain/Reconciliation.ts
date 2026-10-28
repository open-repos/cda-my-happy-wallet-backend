export type SourceType = "ENVELOPE" | "FIXED_EXPENSE" | "FIXED_INCOME";
export type Kind = "DEPENSE" | "ENTREE";

export class ReconciliationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "ReconciliationError";
  }
}

export const safe = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new ReconciliationError("INVALID_AMOUNT");
  return value;
};

/** Parse exact cents. Zero is allowed for a planned amount, never rounded. */
export const cents = (value: unknown): number => {
  if (typeof value !== "string" && typeof value !== "number")
    throw new ReconciliationError("INVALID_AMOUNT");
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new ReconciliationError("INVALID_AMOUNT");
  return safe(Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0")));
};
export const inputAmount = (value: unknown): string => {
  const amount = cents(value);
  if (amount > 9999999999) throw new ReconciliationError("INVALID_AMOUNT");
  return money(amount);
};
export const money = (value: number): string => {
  safe(value);
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
};

export const metrics = (
  source: SourceType,
  planned: number,
  actual: number
) => {
  safe(planned);
  safe(actual);
  const remaining = Math.max(planned - actual, 0);
  const overrun = Math.max(actual - planned, 0);
  // BigInt prevents precision loss in percentage multiplication at large totals.
  const progress =
    planned === 0
      ? null
      : safe(
          Number(
            (BigInt(actual) * BigInt(10000) + BigInt(Math.floor(planned / 2))) /
              BigInt(planned)
          )
        ) / 100;
  return {
    planned: money(planned),
    actual: money(actual),
    remaining: money(remaining),
    overrun: money(overrun),
    progress,
    projected: money(Math.max(planned, actual)),
    status:
      source === "ENVELOPE"
        ? actual > planned
          ? "EXCEEDED"
          : actual === planned
          ? "REACHED"
          : "AVAILABLE"
        : source === "FIXED_INCOME"
        ? actual > planned
          ? "SURPLUS"
          : actual === planned
          ? "RECEIVED"
          : actual === 0
          ? "EXPECTED"
          : "PARTIAL"
        : actual > planned
        ? "EXCEEDED"
        : actual === planned
        ? "PAID"
        : actual === 0
        ? "DUE"
        : "PARTIAL",
    ...(source === "FIXED_INCOME"
      ? {
          expected: money(planned),
          received: money(actual),
          missing: money(remaining),
          surplus: money(overrun),
        }
      : {}),
  };
};

export type Matchable = { month: string; currency: string; kind: Kind };
export const assertCompatible = (
  occurrence: Matchable,
  operation: { operationDate: string; currency: string; kind: Kind }
): void => {
  if (occurrence.currency !== operation.currency)
    throw new ReconciliationError("CURRENCY_MISMATCH");
  if (occurrence.kind !== operation.kind)
    throw new ReconciliationError("TYPE_MISMATCH");
  if (occurrence.month !== operation.operationDate.slice(0, 7))
    throw new ReconciliationError("PERIOD_MISMATCH");
};
