import assert from "assert";
import {
  assertCompatible,
  cents,
  inputAmount,
  metrics,
  money,
  ReconciliationError,
  safe,
} from "../../../src/modules/reconciliation/domain/Reconciliation";
import { personalChargeMinorUnits } from "../../../src/modules/operationsFixes/services/fixedChargeAmounts";
const error = (code: string) => (e: unknown) =>
  e instanceof ReconciliationError && e.code === code;
const partial = metrics("ENVELOPE", 30000, 22300);
assert.deepStrictEqual(partial, {
  planned: "300.00",
  actual: "223.00",
  remaining: "77.00",
  overrun: "0.00",
  progress: 74.33,
  projected: "300.00",
  status: "AVAILABLE",
});
const over = metrics("ENVELOPE", 30000, 33300);
assert.strictEqual(over.projected, "333.00");
assert.strictEqual(over.overrun, "33.00");
assert.strictEqual(over.progress, 111);
assert.strictEqual(over.status, "EXCEEDED");
assert.strictEqual(metrics("FIXED_EXPENSE", 80000, 80000).status, "PAID");
assert.strictEqual(metrics("FIXED_EXPENSE", 80000, 82000).overrun, "20.00");
assert.strictEqual(metrics("FIXED_EXPENSE", 80000, 0).status, "DUE");
const salary = metrics("FIXED_INCOME", 220000, 218000);
assert.strictEqual(salary.missing, "20.00");
assert.strictEqual(salary.surplus, "0.00");
assert.strictEqual(salary.status, "PARTIAL");
assert.strictEqual(metrics("FIXED_INCOME", 100, 101).status, "SURPLUS");
assert.strictEqual(metrics("FIXED_INCOME", 100, 0).status, "EXPECTED");
assert.strictEqual(metrics("ENVELOPE", 0, 0).progress, null);
assert.strictEqual(metrics("ENVELOPE", 0, 1).overrun, "0.01");
assert.strictEqual(metrics("ENVELOPE", 32, 1).progress, 3.13); // half-up
assert.strictEqual(inputAmount(0.29), "0.29");
assert.throws(
  () => metrics("ENVELOPE", 1, Number.MAX_SAFE_INTEGER),
  error("INVALID_AMOUNT")
);
assert.strictEqual(inputAmount("99999999.99"), "99999999.99");
for (const invalid of [
  -1,
  "-1",
  "1.001",
  "1e2",
  "NaN",
  null,
  {},
  "100000000.00",
  Infinity,
])
  assert.throws(() => inputAmount(invalid), error("INVALID_AMOUNT"));
assert.throws(() => safe(Number.MAX_SAFE_INTEGER + 1), error("INVALID_AMOUNT"));
assert.strictEqual(money(cents("10.01")), "10.01");
const personal = personalChargeMinorUnits({
  montant: "800.01",
  pourcentagePersonnel: "50.00",
});
assert.strictEqual(metrics("FIXED_EXPENSE", personal, 40001).status, "PAID"); // no second share
assert.strictEqual(
  personalChargeMinorUnits({ montant: "0.01", pourcentagePersonnel: "50" }),
  1
);
const occurrence = {
  month: "2026-10",
  currency: "EUR",
  kind: "DEPENSE" as const,
};
const operation = {
  operationDate: "2026-10-01",
  currency: "EUR",
  kind: "DEPENSE" as const,
};
assertCompatible(occurrence, operation);
for (const [override, code] of [
  [{ currency: "USD" }, "CURRENCY_MISMATCH"],
  [{ kind: "ENTREE" }, "TYPE_MISMATCH"],
  [{ operationDate: "2026-11-01" }, "PERIOD_MISMATCH"],
] as const) {
  assert.throws(
    () => assertCompatible(occurrence, { ...operation, ...override }),
    error(code)
  );
}
console.log(
  "Reconciliation domain: acceptance amounts, half-up cents, shared personal basis, zeros and incompatibilities passed"
);
