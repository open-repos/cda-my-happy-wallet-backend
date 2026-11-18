import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { rewindMonthEndMigration } from "./migrationFixture";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw Error("Disposable test database required");
const prisma = new PrismaClient();
const emails = [
  "month-end-migration@test.local",
  "month-end-migration-other@test.local",
];
async function run() {
  if (process.argv[2] === "prepare") {
    await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
    await rewindMonthEndMigration(prisma);
    const owner = await prisma.utilisateur.create({
      data: {
        email: emails[0],
        firstname: "Legacy",
        lastname: "Test",
        password: "test-only",
      },
    });
    const account = await prisma.savingsAccount.create({
      data: {
        userId: owner.id,
        name: "Legacy",
        currency: "EUR",
        initialBalanceMinorUnits: 10000,
        balanceMinorUnits: 10123,
      },
    });
    await prisma.$executeRaw`INSERT INTO SavingsMovement (userId, accountId, amountMinorUnits, direction, reason, currency, operationDate, idempotencyKey)
      VALUES (${owner.id}, ${account.id}, 123, 'TO_SAVINGS', 'MANUAL', 'EUR', '2026-10-31', 'legacy-month-end-test')`;
  } else if (process.argv[2] === "verify") {
    const owner = await prisma.utilisateur.findUniqueOrThrow({
      where: { email: emails[0] },
    });
    try {
      const account = await prisma.savingsAccount.findFirstOrThrow({
        where: { userId: owner.id },
      });
      assert.equal(Number(account.balanceMinorUnits), 10123);
      const movement = await prisma.savingsMovement.findFirstOrThrow({
        where: { userId: owner.id },
      });
      assert.equal(Number(movement.amountMinorUnits), 123);
      assert.equal(movement.monthEndDecisionId, null);
      assert.equal(movement.isCompensation, false);
      assert.equal(
        await prisma.monthEndDecision.count({ where: { userId: owner.id } }),
        0
      );
      const collation = await prisma.$queryRaw<
        { name: string }[]
      >`SELECT COLLATION_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'MonthEndDecisionReceipt' AND COLUMN_NAME = 'idempotencyKey'`;
      assert.equal(collation[0].name, "utf8mb4_bin");
      const data = {
        userId: owner.id,
        month: new Date("2026-10-01"),
        operationDate: new Date("2026-10-31"),
        currency: "EUR",
        revision: 1,
        referenceResultMinorUnits: 0,
        savingsMinorUnits: 0,
        coverageMinorUnits: 0,
        exceptionalIncomeMinorUnits: 0,
        allocations: {
          savings: [],
          coverage: [],
          exceptionalIncomeMinorUnits: 0,
        },
      };
      await assert.rejects(() =>
        prisma.monthEndDecision.create({
          data: { ...data, exceptionalIncomeMinorUnits: -1 },
        })
      );
      const decision = await prisma.monthEndDecision.create({ data });
      const other = await prisma.utilisateur.create({
        data: {
          email: emails[1],
          firstname: "Other",
          lastname: "Test",
          password: "test-only",
        },
      });
      await assert.rejects(() =>
        prisma.monthEndDecisionReceipt.create({
          data: {
            userId: other.id,
            decisionId: decision.id,
            revision: 1,
            idempotencyKey: "foreign-receipt-001",
            requestHash: "0".repeat(64),
            response: {},
          },
        })
      );
      await assert.rejects(() =>
        prisma.savingsMovement.create({
          data: {
            userId: owner.id,
            accountId: account.id,
            amountMinorUnits: 1,
            direction: "FROM_SAVINGS",
            reason: "MONTH_END",
            currency: "EUR",
            operationDate: new Date("2026-10-31"),
            idempotencyKey: "missing-revision-compensation",
            isCompensation: true,
          },
        })
      );
      console.log(
        "Month-end migration: legacy cents preserved, case-sensitive receipts, checks and owner foreign keys passed"
      );
    } finally {
      await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
    }
  } else throw Error("Expected prepare or verify");
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
