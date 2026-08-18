import assert from "assert";
import { readFileSync } from "fs";
import { resolve } from "path";

const schema = readFileSync(
  resolve(process.cwd(), "src/database/schema.prisma"),
  "utf8"
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    "src/database/migrations/20260818190000_add_collection_pagination_indexes/migration.sql"
  ),
  "utf8"
);

for (const index of [
  "@@index([userId, idOperationFixe])",
  "@@index([userId, typeOperation, idOperationFixe])",
  "@@index([userId, name, id])",
  "@@index([userId, operationDate, id])",
]) {
  assert.ok(schema.includes(index), `Missing Prisma index: ${index}`);
}

for (const index of [
  "OperationFixe_userId_idOperationFixe_idx",
  "OperationFixe_userId_typeOperation_idOperationFixe_idx",
  "OperationCategory_userId_name_id_idx",
  "OneOffOperationRecord_userId_operationDate_id_idx",
]) {
  assert.ok(migration.includes(`CREATE INDEX \`${index}\``));
}

assert.ok(!migration.includes("DROP "));
assert.ok(!migration.includes("DELETE "));

console.log("Pagination schema tests passed");
