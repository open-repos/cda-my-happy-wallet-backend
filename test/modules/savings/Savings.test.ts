import assert from "assert";
import {
  applyTransfer,
  balanceFromLedger,
  SavingsError,
  validateAccount,
  validateTransfer,
} from "../../../src/modules/savings/domain/Savings";

const transfer = validateTransfer(
  {
    direction: "TO_SAVINGS",
    amountMinorUnits: 101,
    operationDate: "2026-11-07",
    reason: "MANUAL",
    idempotencyKey: "test-transfer-0001",
  },
  "2026-11-07"
);
assert.equal(applyTransfer(500, transfer), 601);
assert.equal(
  applyTransfer(500, { ...transfer, direction: "FROM_SAVINGS" }),
  399
);
assert.equal(balanceFromLedger(100, [101, -50, 1]), 152);
const rejects = (fn: () => unknown, code: string) =>
  assert.throws(
    fn,
    (e: unknown) => e instanceof SavingsError && e.code === code
  );
rejects(
  () => applyTransfer(0, { ...transfer, direction: "FROM_SAVINGS" }),
  "INSUFFICIENT_SAVINGS"
);
rejects(() => applyTransfer(9999999999, transfer), "BALANCE_LIMIT");
for (const amountMinorUnits of [0, -1, 1.5, Infinity, 10000000000]) {
  rejects(
    () => validateTransfer({ ...transfer, amountMinorUnits }, "2026-11-07"),
    "INVALID_AMOUNT"
  );
}
for (const operationDate of [
  "2026-02-30",
  "2026-11-08",
  "0000-01-01",
  "1900-02-29",
]) {
  rejects(
    () => validateTransfer({ ...transfer, operationDate }, "2026-11-07"),
    "INVALID_DATE"
  );
}
rejects(
  () =>
    validateTransfer(
      { ...transfer, reason: "NEGATIVE_COVERAGE" },
      "2026-11-07"
    ),
  "INVALID_REASON"
);
rejects(
  () =>
    validateTransfer(
      { ...transfer, direction: "FROM_SAVINGS", reason: "MONTH_END" },
      "2026-11-07"
    ),
  "INVALID_REASON"
);
assert.deepEqual(
  validateAccount({
    name: " Vacances ",
    currency: "eur",
    initialBalanceMinorUnits: 125,
  }),
  { name: "Vacances", currency: "EUR", initialBalanceMinorUnits: 125 }
);
rejects(
  () =>
    validateAccount({
      name: "x",
      currency: "EUR",
      initialBalanceMinorUnits: -1,
    }),
  "INVALID_ACCOUNT"
);
console.log("Savings domain tests passed");
