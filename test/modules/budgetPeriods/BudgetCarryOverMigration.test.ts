import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const migration = "20261011150000_add_budget_period_carry_in";
const email = "carry-migration@example.test";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Carry-over migration tests require the disposable test database."
  );
}
if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();

const prepare = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Carry",
      lastname: "Migration",
      email,
      password: "not-a-real-password",
    },
  });
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `BudgetPeriod` DROP COLUMN `carryIn`"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `BudgetPeriod` DROP COLUMN `correctedAt`"
  );
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` IN (?, ?)",
    migration,
    "20261011170000_add_budget_period_corrected_at"
  );
  await prisma.$executeRawUnsafe(
    "INSERT INTO `BudgetPeriod` (`periodStart`, `currency`, `fixedIncome`, `fixedExpense`, `baseAmount`, `updatedAt`, `userId`) VALUES (?, 'EUR', 100, 40, 60, NOW(), ?)",
    new Date("2026-09-01T00:00:00.000Z"),
    user.id
  );
};

const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  const period = await prisma.budgetPeriod.findFirstOrThrow({
    where: { userId: user.id },
  });
  // Une période existante n'a pas de report rétroactif.
  assert.strictEqual(period.carryIn.toFixed(2), "0.00");
  assert.strictEqual(period.baseAmount.toFixed(2), "60.00");
  assert.strictEqual(period.correctedAt, null);
  await prisma.utilisateur.delete({ where: { id: user.id } });
};

(phase === "prepare" ? prepare : verify)()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    throw error;
  });
