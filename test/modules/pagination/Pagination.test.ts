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

// The cursor is random ciphertext: its base64url text may contain "42" by
// chance. Opacity is asserted on the decoded payload bytes, against clear
// forms of at least seven bytes, so a coincidence is negligible (~2^-48).
const clearForms = (
  position: readonly (string | number)[]
): readonly string[] => {
  const json = JSON.stringify({ ...context, position });
  return [json, `"position":${JSON.stringify(position)}`, context.scope];
};

const assertOpaque = (
  opaqueCursor: string,
  position: readonly (string | number)[]
): void => {
  const payload = Buffer.from(opaqueCursor.slice("v1.".length), "base64url");
  for (const form of clearForms(position)) {
    assert.ok(!payload.includes(form), `payload exposes ${form}`);
    const encoded = Buffer.from(form, "utf8").toString("base64url");
    assert.ok(!opaqueCursor.includes(encoded), `cursor encodes ${form}`);
  }
};

const cursor = codec.encode(context, [42]);
assert.match(cursor, /^v1\.[A-Za-z0-9_-]+$/);
assertOpaque(cursor, [42]);

const marker = "cursor-opacity-marker-7c1e9b4d";
const markedCursor = codec.encode(context, [marker, 42]);
assertOpaque(markedCursor, [marker, 42]);
assert.ok(!markedCursor.includes(marker));
assert.deepStrictEqual(codec.decode(context, markedCursor), [marker, 42]);

// Regression for #166: a cursor whose text contains "42" by coincidence
// (about 2% of cursors) is still opaque and decodes to the right position.
let coincidentalCursor: string | null = null;
for (let attempt = 0; attempt < 5000 && !coincidentalCursor; attempt += 1) {
  const candidate = codec.encode(context, [42]);
  if (candidate.includes("42")) coincidentalCursor = candidate;
}
assert.ok(coincidentalCursor, "no coincidental cursor generated");
assertOpaque(coincidentalCursor, [42]);
assert.deepStrictEqual(codec.decode(context, coincidentalCursor), [42]);
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
