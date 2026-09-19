import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const migration = "20260919110000_add_budget_periods";
const email = "budget-period-migration@example.test";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Budget period migration tests require the disposable test database."
  );
}
if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();

const prepare = async () => {
  await prisma.$executeRawUnsafe(
    "DROP INDEX `OneOffOperationRecord_userId_currency_operationDate_id_idx` ON `OneOffOperationRecord`"
  );
  await prisma.$executeRawUnsafe("DROP TABLE `BudgetPeriod`");
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` = ?",
    migration
  );
};

const verify = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Migration",
      lastname: "Budget",
      email,
      password: "not-a-real-password",
    },
  });
  const created = await prisma.budgetPeriod.create({
    data: {
      userId: user.id,
      periodStart: new Date("2026-09-01T00:00:00.000Z"),
      currency: "EUR",
      fixedIncome: "2000.00",
      fixedExpense: "1250.50",
      baseAmount: "749.50",
    },
  });
  assert.strictEqual(created.status, "OPEN");
  assert.strictEqual(created.revision, 1);
  await assert.rejects(() =>
    prisma.budgetPeriod.create({
      data: {
        userId: user.id,
        periodStart: new Date("2026-09-01T00:00:00.000Z"),
        currency: "EUR",
        fixedIncome: "0.00",
        fixedExpense: "0.00",
        baseAmount: "0.00",
      },
    })
  );
  await prisma.utilisateur.delete({ where: { id: user.id } });
  assert.strictEqual(
    await prisma.budgetPeriod.count({ where: { userId: user.id } }),
    0
  );
};

(phase === "prepare" ? prepare : verify)()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    throw error;
  });
