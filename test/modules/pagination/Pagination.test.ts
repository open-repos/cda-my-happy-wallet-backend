import assert from "assert";
import { ErrorException } from "../../../src/utils/errors";
import {
  createCursorPage,
  decodePositiveIntegerCursor,
  PaginationCursorCodec,
  parsePaginationRequest,
} from "../../../src/modules/pagination";

const codec = new PaginationCursorCodec(
  "pagination-unit-test-secret-at-least-32-characters"
);
const context = { resource: "test-items", scope: "owner:7" };

const rejectsAsValidation = (action: () => unknown): void => {
  assert.throws(
    action,
    (error: unknown) =>
      error instanceof ErrorException &&
      error.status === 422 &&
      error.message === "Pagination parameters are invalid"
  );
};

const defaults = parsePaginationRequest({});
assert.deepStrictEqual(defaults, { limit: 50, cursor: null });
assert.deepStrictEqual(parsePaginationRequest({ limit: "1" }), {
  limit: 1,
  cursor: null,
});
assert.deepStrictEqual(parsePaginationRequest({ limit: "100" }), {
  limit: 100,
  cursor: null,
});

for (const query of [
  { limit: "0" },
  { limit: "101" },
  { limit: "1.5" },
  { limit: ["10"] },
  { offset: "10" },
  { cursor: "" },
]) {
  rejectsAsValidation(() => parsePaginationRequest(query));
}

const cursor = codec.encode(context, [42]);
assert.match(cursor, /^v1\.[A-Za-z0-9_-]+$/);
assert.ok(!cursor.includes("42"));
assert.deepStrictEqual(codec.decode(context, cursor), [42]);
assert.strictEqual(
  decodePositiveIntegerCursor({ limit: 10, cursor }, context, codec),
  42
);

const lastCharacter = cursor.endsWith("A") ? "B" : "A";
rejectsAsValidation(() =>
  codec.decode(context, `${cursor.slice(0, -1)}${lastCharacter}`)
);
rejectsAsValidation(() =>
  codec.decode({ ...context, scope: "owner:8" }, cursor)
);
rejectsAsValidation(() =>
  codec.decode({ ...context, resource: "other-items" }, cursor)
);
rejectsAsValidation(() => codec.decode(context, cursor.replace(/^v1/, "v2")));

const page = createCursorPage(
  [{ id: 3 }, { id: 2 }, { id: 1 }],
  { limit: 2, cursor: null },
  context,
  (row) => [row.id],
  codec
);
assert.deepStrictEqual(page.data, [{ id: 3 }, { id: 2 }]);
assert.strictEqual(page.meta.limit, 2);
assert.strictEqual(page.meta.hasNext, true);
assert.ok(page.meta.nextCursor);
assert.deepStrictEqual(
  codec.decode(context, page.meta.nextCursor as string),
  [2]
);

const lastPage = createCursorPage(
  [{ id: 1 }],
  { limit: 2, cursor: page.meta.nextCursor },
  context,
  (row) => [row.id],
  codec
);
assert.deepStrictEqual(lastPage.meta, {
  limit: 2,
  hasNext: false,
  nextCursor: null,
});

console.log("Pagination unit tests passed");
