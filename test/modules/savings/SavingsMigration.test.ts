import assert from "assert";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw Error("Disposable test database required");
const prisma = new PrismaClient();
const email = "savings-migration@test.local",
  migration = "20261107185000_add_savings_accounts";
async function run() {
  if (process.argv[2] === "prepare") {
    // These are exclusively the new tables, in dependency order, in the guarded disposable DB.
    await prisma.$executeRaw`DROP TABLE SavingsOccurrenceResolution`;
    await prisma.$executeRaw`DROP TABLE SavingsMovement`;
    await prisma.$executeRaw`DROP TABLE SavingsGoalLink`;
    await prisma.$executeRaw`DROP TABLE SavingsAccount`;
    await prisma.$executeRaw`ALTER TABLE ObjectifFinancier DROP INDEX ObjectifFinancier_id_userId_key`;
    await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = ${migration}`;
    await prisma.utilisateur.deleteMany({ where: { email } });
    const user = await prisma.utilisateur.create({
      data: {
        email,
        firstname: "Legacy",
        lastname: "Savings",
        password: "test-only",
      },
    });
    await prisma.objectifFinancier.create({
      data: {
        userId: user.id,
        title: "Historique",
        targetAmount: "1234.56",
        savedAmount: "321.09",
        monthlyContribution: "12.34",
        currency: "EUR",
      },
    });
  } else if (process.argv[2] === "verify") {
    const user = await prisma.utilisateur.findUniqueOrThrow({
      where: { email },
    });
    try {
      const goal = await prisma.objectifFinancier.findFirstOrThrow({
        where: { userId: user.id },
      });
      const columns = await prisma.$queryRaw<
        { collationName: string }[]
      >`SELECT COLLATION_NAME AS collationName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'SavingsMovement' AND COLUMN_NAME = 'idempotencyKey'`;
      assert.equal(columns[0].collationName, "utf8mb4_bin");
      assert.equal(goal.savedAmount.toFixed(2), "321.09");
      assert.equal(goal.monthlyContribution.toFixed(2), "12.34");
      assert.equal(
        await prisma.savingsAccount.count({ where: { userId: user.id } }),
        0
      );
      const account = await prisma.savingsAccount.create({
        data: { userId: user.id, name: "Nouveau", currency: "EUR" },
      });
      await assert.rejects(() =>
        prisma.savingsAccount.update({
          where: { id: account.id },
          data: { balanceMinorUnits: -1 },
        })
      );
      const other = await prisma.utilisateur.create({
        data: {
          email: "savings-migration-other@test.local",
          firstname: "Other",
          lastname: "Tests",
          password: "test-only",
        },
      });
      try {
        await assert.rejects(() =>
          prisma.savingsGoalLink.create({
            data: {
              userId: other.id,
              accountId: account.id,
              goalId: goal.id,
              linkedOn: new Date("2026-11-07T00:00:00Z"),
            },
          })
        );
        await assert.rejects(() =>
          prisma.savingsMovement.create({
            data: {
              userId: user.id,
              accountId: account.id,
              amountMinorUnits: 0,
              currency: "EUR",
              direction: "TO_SAVINGS",
              reason: "MANUAL",
              idempotencyKey: "invalid-db-amount",
              operationDate: new Date("2026-11-07T00:00:00Z"),
            },
          })
        );
      } finally {
        await prisma.utilisateur.delete({ where: { id: other.id } });
      }
      console.log(
        "Additive savings migration preserves goals and enforces cents/ownership constraints"
      );
    } finally {
      await prisma.utilisateur.delete({ where: { id: user.id } });
    }
  } else throw Error("Expected prepare or verify");
}
run()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
