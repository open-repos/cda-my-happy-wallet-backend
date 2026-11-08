/** Integer cents share the existing goals/budget Decimal(10,2) range. */
export const MAX_SAVINGS_MINOR_UNITS = 9999999999;

export class SavingsError extends Error {
  public constructor(public readonly code: string) {
    super(code);
    this.name = "SavingsError";
  }
}

export type Transfer = Readonly<{
  direction: "TO_SAVINGS" | "FROM_SAVINGS";
  amountMinorUnits: number;
  operationDate: string;
  reason: "MANUAL" | "MONTH_END" | "NEGATIVE_COVERAGE" | "GOAL";
  idempotencyKey: string;
}>;

export function isCivilDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1000-01-01" &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

export function validateAccount(input: {
  name: string;
  currency: string;
  initialBalanceMinorUnits: number;
}) {
  if (
    typeof input.name !== "string" ||
    input.name.trim().length < 2 ||
    [...input.name.trim()].length > 50 ||
    typeof input.currency !== "string" ||
    !/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase()) ||
    !Number.isSafeInteger(input.initialBalanceMinorUnits) ||
    input.initialBalanceMinorUnits < 0 ||
    input.initialBalanceMinorUnits > MAX_SAVINGS_MINOR_UNITS
  )
    throw new SavingsError("INVALID_ACCOUNT");
  return {
    initialBalanceMinorUnits: input.initialBalanceMinorUnits,
    name: input.name.trim(),
    currency: input.currency.trim().toUpperCase(),
  };
}

export function validateTransfer(input: Transfer, today: string): Transfer {
  if (
    !Number.isSafeInteger(input.amountMinorUnits) ||
    input.amountMinorUnits <= 0 ||
    input.amountMinorUnits > MAX_SAVINGS_MINOR_UNITS
  )
    throw new SavingsError("INVALID_AMOUNT");
  if (
    typeof input.operationDate !== "string" ||
    !isCivilDate(input.operationDate) ||
    input.operationDate > today
  )
    throw new SavingsError("INVALID_DATE");
  if (input.direction !== "TO_SAVINGS" && input.direction !== "FROM_SAVINGS")
    throw new SavingsError("INVALID_DIRECTION");
  if (
    !["MANUAL", "MONTH_END", "NEGATIVE_COVERAGE", "GOAL"].includes(
      input.reason
    ) ||
    (input.reason === "NEGATIVE_COVERAGE" &&
      input.direction !== "FROM_SAVINGS") ||
    (["MONTH_END", "GOAL"].includes(input.reason) &&
      input.direction !== "TO_SAVINGS")
  )
    throw new SavingsError("INVALID_REASON");
  if (
    typeof input.idempotencyKey !== "string" ||
    !/^[A-Za-z0-9:_-]{8,100}$/.test(input.idempotencyKey)
  )
    throw new SavingsError("INVALID_IDEMPOTENCY_KEY");
  return { ...input };
}

export function applyTransfer(
  balance: number,
  transfer: Pick<Transfer, "direction" | "amountMinorUnits">
): number {
  const result =
    balance +
    (transfer.direction === "TO_SAVINGS" ? 1 : -1) * transfer.amountMinorUnits;
  if (result < 0) throw new SavingsError("INSUFFICIENT_SAVINGS");
  if (!Number.isSafeInteger(result) || result > MAX_SAVINGS_MINOR_UNITS)
    throw new SavingsError("BALANCE_LIMIT");
  return result;
}

export function balanceFromLedger(
  initial: number,
  signedMovements: readonly number[]
): number {
  const result = signedMovements.reduce(
    (total, amount) => total + BigInt(amount),
    BigInt(initial)
  );
  if (result < BigInt(0)) throw new SavingsError("INSUFFICIENT_SAVINGS");
  if (result > BigInt(MAX_SAVINGS_MINOR_UNITS))
    throw new SavingsError("BALANCE_LIMIT");
  return Number(result);
}
