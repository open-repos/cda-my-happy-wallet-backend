import assert from "assert";
import {
  CreateOneOffOperationProps,
  OneOffOperation,
  OneOffOperationError,
  OneOffOperationErrorCode,
} from "../../../src/modules/operations/domain";

const validOperation: CreateOneOffOperationProps = {
  id: 9,
  ownerId: 12,
  title: "  Courses du samedi  ",
  amount: "42.05",
  currency: "eur",
  kind: "DEPENSE",
  operationDate: "2026-08-09",
  category: { id: 3, ownerId: 12 },
};

const operation = OneOffOperation.create(validOperation);

assert.strictEqual(operation.id, 9);
assert.strictEqual(operation.ownerId, 12);
assert.strictEqual(operation.title, "Courses du samedi");
assert.strictEqual(operation.money.minorUnits, 4205);
assert.strictEqual(operation.money.currency, "EUR");
assert.strictEqual(operation.kind, "DEPENSE");
assert.strictEqual(operation.operationDate, "2026-08-09");
assert.strictEqual(operation.categoryId, 3);

const assertDomainError = (
  overrides: Partial<CreateOneOffOperationProps>,
  expectedCode: OneOffOperationErrorCode
): void => {
  assert.throws(
    () => OneOffOperation.create({ ...validOperation, ...overrides }),
    (error: unknown) =>
      error instanceof OneOffOperationError && error.code === expectedCode
  );
};

assertDomainError({ id: 0 }, "INVALID_ID");
assertDomainError({ ownerId: -1 }, "INVALID_OWNER_ID");
assertDomainError({ category: { id: 0, ownerId: 12 } }, "INVALID_CATEGORY_ID");
assertDomainError(
  { category: { id: 3, ownerId: 99 } },
  "CATEGORY_OWNER_MISMATCH"
);
assertDomainError({ title: " " }, "INVALID_TITLE");
assertDomainError({ title: "x".repeat(51) }, "INVALID_TITLE");
assertDomainError({ title: 42 as unknown as string }, "INVALID_TITLE");
assertDomainError({ amount: 0 }, "INVALID_AMOUNT");
assertDomainError({ amount: "12.345" }, "INVALID_AMOUNT");
assertDomainError({ amount: "100000000.00" }, "INVALID_AMOUNT");
assertDomainError({ currency: "EURO" }, "INVALID_CURRENCY");
assertDomainError({ currency: 978 as unknown as string }, "INVALID_CURRENCY");
assertDomainError(
  { kind: "CREDIT" as CreateOneOffOperationProps["kind"] },
  "INVALID_KIND"
);
assertDomainError({ operationDate: "2026-02-29" }, "INVALID_OPERATION_DATE");
assertDomainError({ operationDate: "09/08/2026" }, "INVALID_OPERATION_DATE");

const income = OneOffOperation.create({
  ...validOperation,
  id: undefined,
  amount: 10.5,
  kind: "ENTREE",
});

assert.strictEqual(income.id, undefined);
assert.strictEqual(income.money.minorUnits, 1050);
assert.strictEqual(income.kind, "ENTREE");
