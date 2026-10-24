import assert from "assert";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { UserRepo } from "../../../src/modules/user/userRepo";
import { OperationFixeRepo } from "../../../src/modules/operationsFixes/operationFixeRepo";
import { PrismaOperationCategoryRepository } from "../../../src/modules/operations/infrastructure/PrismaOperationCategoryRepository";

const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
) {
  throw new Error(
    "Fixed category persistence tests require the disposable myhappywallet_test database"
  );
}
const prisma = new PrismaClient();
const emails = [
  "fixed-categories-existing@example.test",
  "fixed-categories-new@example.test",
];
async function clean() {
  const users = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
  });
  for (const user of users) {
    await prisma.operationFixe.deleteMany({ where: { userId: user.id } });
    await prisma.utilisateur.delete({ where: { id: user.id } });
  }
}
async function run() {
  await clean();
  const user = await prisma.utilisateur.create({
    data: {
      email: emails[0],
      firstname: "Existing",
      lastname: "Test",
      password: "not-a-real-password",
    },
  });
  const custom = await prisma.operationCategory.create({
    data: {
      userId: user.id,
      name: "Logement",
      icon: "solid:star",
      color: "#123456",
    },
  });
  const old = await prisma.operationFixe.create({
    data: {
      userId: user.id,
      titre: "Ancienne charge",
      montant: 120,
      devise: "EUR",
    },
  });
  // Replay only the backfill statements on the guarded test database. DDL is
  // applied once by migrate deploy; data inserts must remain repeatable.
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../../../src/database/migrations/20261024090000_fixed_operation_categories/migration.sql"
    ),
    "utf8"
  );
  const dataSql = sql.slice(
    sql.indexOf("INSERT INTO `OperationCategoryTemplate`")
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const statement of dataSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await prisma.$executeRawUnsafe(statement);
  }
  const categories = await prisma.operationCategory.findMany({
    where: { userId: user.id },
  });
  assert.strictEqual(categories.length, 20);
  assert.deepStrictEqual(
    await prisma.operationCategory.findUnique({ where: { id: custom.id } }),
    custom
  );
  assert.strictEqual(
    (
      await prisma.operationFixe.findUniqueOrThrow({
        where: { idOperationFixe: old.idOperationFixe },
      })
    ).categoryId,
    null
  );
  const future = await new UserRepo(prisma).create({
    email: emails[1],
    firstname: "New",
    lastname: "Test",
    password: "not-a-real-password",
    confirmpassword: "not-a-real-password",
  });
  const futureCategories = await prisma.operationCategory.findMany({
    where: { userId: future.id, fixedKind: { not: null } },
  });
  assert.strictEqual(futureCategories.length, 20);
  assert.ok(futureCategories.every((c) => c.icon?.startsWith("solid:")));
  const category = categories.find((c) => c.name === "Assurances")!;
  const repository = new OperationFixeRepo(prisma);
  const saved = await repository.create(
    {
      titre: "Assurance",
      montant: 120,
      devise: "EUR",
      categoryId: category.id,
    },
    String(user.id),
    "CHARGE"
  );
  assert.ok(saved.category, "The saved fixed charge must expose its assigned category");
  assert.strictEqual(saved.category.icon, "solid:shield-halved");
  await assert.rejects(
    prisma.operationFixe.create({
      data: {
        userId: future.id,
        titre: "Forbidden",
        montant: 1,
        categoryId: category.id,
      },
    }),
    (error: any) => error.code === "P2003"
  );
  await assert.rejects(
    new PrismaOperationCategoryRepository(prisma).delete(category.id, user.id),
    (error: any) => error.code === "CATEGORY_IN_USE"
  );
  await repository.update(
    {
      id: saved.idOperationFixe,
      titre: "Assurance",
      montant: 120,
      devise: "EUR",
      categoryId: null,
    },
    String(user.id),
    String(saved.idOperationFixe),
    "CHARGE"
  );
  assert.strictEqual(
    await new PrismaOperationCategoryRepository(prisma).delete(
      category.id,
      user.id
    ),
    true
  );
  console.log(
    "MySQL: repeatable backfill, custom values preserved, old rows uncategorized, new users, composite ownership and deletion restriction passed"
  );
}
run()
  .finally(async () => {
    await clean();
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
