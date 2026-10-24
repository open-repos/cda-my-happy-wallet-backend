import assert from "assert";
import fs from "fs";
import path from "path";
import { isCategoryIcon } from "../../../src/modules/operations/domain/CategoryIcon";
import { UserRepo } from "../../../src/modules/user/userRepo";

async function run() {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../../../src/database/migrations/20261024090000_fixed_operation_categories/migration.sql"
    ),
    "utf8"
  );
  const defaults = [
    ...sql.matchAll(
      /SELECT '(FIXED_[^']+)' AS code, '([^']+)' AS name, '(solid:[^']+)' AS icon, '(CHARGE|REVENU)' AS fixedKind/g
    ),
  ].map((match, index) => ({
    id: index + 1,
    name: match[2],
    icon: match[3],
    fixedKind: match[4],
    color: null,
  }));
  assert.strictEqual(defaults.length, 20);
  assert.strictEqual(
    defaults.filter((d) => d.fixedKind === "CHARGE").length,
    12
  );
  assert.strictEqual(
    defaults.filter((d) => d.fixedKind === "REVENU").length,
    8
  );
  for (const item of defaults) assert.ok(isCategoryIcon(item.icon), item.icon);
  let created: any;
  const transaction = {
    operationCategoryTemplate: { findMany: async () => defaults },
    utilisateur: {
      create: async ({ data }: any) => {
        created = data;
        return { id: 42 };
      },
    },
  };
  const repo = new UserRepo({
    $transaction: async (fn: any) => fn(transaction),
  });
  await repo.create({
    email: "new@example.test",
    password: "not-a-real-password",
    confirmpassword: "not-a-real-password",
    firstname: "Test",
    lastname: "User",
  });
  assert.deepStrictEqual(
    created.operationCategories.create.map(
      ({ name, icon, fixedKind }: any) => ({ name, icon, fixedKind })
    ),
    defaults.map(({ name, icon, fixedKind }) => ({ name, icon, fixedKind }))
  );
  console.log(
    "All 20 default icons are allowed; registration preserves template icons and fixed kinds"
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
