import assert from "assert";
import { ErrorException } from "../../../src/utils/errors";
import {
  parseOperationListQuery,
  parseTitleSuggestionQuery,
} from "../../../src/modules/operations/presentation/operationValidators";

const rejects = (query: Record<string, unknown>): void => {
  assert.throws(
    () => parseOperationListQuery(query),
    (error: unknown) => error instanceof ErrorException && error.status === 422,
    JSON.stringify(query)
  );
};

// Sans paramètre de tri ni nouveau filtre, la requête reste celle d'avant #165.
assert.deepStrictEqual(parseOperationListQuery({}), {
  filter: {},
  sort: undefined,
  pagination: { limit: 50, cursor: null },
});

assert.deepStrictEqual(
  parseOperationListQuery({ sort: "amount", order: "desc", limit: "10" }),
  {
    filter: {},
    sort: { field: "amount", order: "desc" },
    pagination: { limit: 10, cursor: null },
  }
);
for (const field of ["date", "title", "category", "amount"]) {
  assert.deepStrictEqual(parseOperationListQuery({ sort: field }).sort, {
    field,
    order: "asc",
  });
}

assert.deepStrictEqual(
  parseOperationListQuery({
    title: "  Électricité ",
    categoryId: ["7", "3", "7"],
    type: "DEPENSE",
    minAmount: "12.5",
    maxAmount: "100",
    from: "2026-01-01",
    to: "2026-12-31",
    currency: "eur",
  }).filter,
  {
    from: "2026-01-01",
    to: "2026-12-31",
    currency: "EUR",
    title: "Électricité",
    categoryIds: [3, 7],
    kind: "DEPENSE",
    minAmount: "12.50",
    maxAmount: "100.00",
  }
);
assert.deepStrictEqual(
  parseOperationListQuery({ categoryId: "4" }).filter.categoryIds,
  [4]
);
assert.deepStrictEqual(
  parseOperationListQuery({ minAmount: "5", maxAmount: "5.00" }).filter,
  { minAmount: "5.00", maxAmount: "5.00" }
);
assert.strictEqual(
  parseOperationListQuery({ title: "a".repeat(50) }).filter.title?.length,
  50
);

for (const query of [
  { sort: "id" },
  { sort: "" },
  { sort: ["date", "title"] },
  { order: "desc" },
  { sort: "date", order: "up" },
  { title: "" },
  { title: "   " },
  { title: "a".repeat(51) },
  { title: ["a", "b"] },
  { categoryId: "0" },
  { categoryId: "-1" },
  { categoryId: "1.5" },
  { categoryId: "abc" },
  { categoryId: Array.from({ length: 21 }, (_, index) => String(index + 1)) },
  { type: "depense" },
  { type: "CHARGE" },
  { minAmount: "-1" },
  { minAmount: "1.234" },
  { minAmount: "123456789" },
  { maxAmount: "abc" },
  { minAmount: "10", maxAmount: "9.99" },
  { search: "x" },
  { categoryIds: "1" },
]) {
  rejects(query);
}

// #174 : suggestions de libellés, 10 par défaut et 50 au maximum.
assert.deepStrictEqual(parseTitleSuggestionQuery({}), {
  query: undefined,
  pagination: { limit: 10, cursor: null },
});
assert.deepStrictEqual(
  parseTitleSuggestionQuery({ q: "   " }).query,
  undefined
);
assert.deepStrictEqual(
  parseTitleSuggestionQuery({ q: " Élec ", limit: "50", cursor: "c" }),
  { query: "Élec", pagination: { limit: 50, cursor: "c" } }
);
assert.strictEqual(
  parseTitleSuggestionQuery({ q: "a".repeat(50) }).query?.length,
  50
);
for (const query of [
  { q: "a".repeat(51) },
  { q: ["a", "b"] },
  { limit: "0" },
  { limit: "51" },
  { limit: "abc" },
  { cursor: "" },
  { title: "Loyer" },
  { sort: "title" },
]) {
  assert.throws(
    () => parseTitleSuggestionQuery(query),
    (error: unknown) => error instanceof ErrorException && error.status === 422,
    JSON.stringify(query)
  );
}

console.log("Operation list query tests passed");
