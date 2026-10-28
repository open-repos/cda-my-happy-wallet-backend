import assert from "assert";
import { PrismaClient } from "@prisma/client";
const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw new Error("Disposable MySQL required");
const db = new PrismaClient();
const email = "envelope-integration-migration@example.test";
async function clean() {
  const u = await db.utilisateur.findUnique({ where: { email } });
  if (!u) return;
  await db.operationFixe.deleteMany({ where: { userId: u.id } });
  await db.utilisateur.delete({ where: { id: u.id } });
}
async function run() {
  if (process.argv[2] === "prepare") {
    await clean();
    assert.strictEqual(await db.fixedOperationVersion.count(), 0);
    assert.strictEqual(
      await db.budgetPeriod.count({
        where: { reconciliationAdjustment: { not: 0 } },
      }),
      0
    );
    const user = await db.utilisateur.create({
      data: {
        email,
        password: "test-only",
        firstname: "Migration",
        lastname: "Test",
      },
    });
    await db.operationFixe.create({
      data: {
        userId: user.id,
        titre: "Ancienne charge",
        montant: "300.01",
        devise: "EUR",
      },
    });
    await db.budgetPeriod.create({
      data: {
        userId: user.id,
        periodStart: new Date("2026-09-01T00:00:00Z"),
        currency: "EUR",
        status: "CLOSED",
        fixedIncome: "2000",
        fixedExpense: "1100",
        baseAmount: "900",
        actualExpense: "400",
        realRemaining: "500",
        revision: 7,
      },
    });
    await db.$executeRawUnsafe("DROP TABLE FixedOperationVersion");
    await db.$executeRawUnsafe(
      "ALTER TABLE OperationFixe DROP INDEX OperationFixe_idOperationFixe_userId_key, DROP COLUMN isBudgetEnvelope, DROP COLUMN budgetStartMonth, DROP COLUMN budgetEndMonth, DROP COLUMN budgetArchived"
    );
    await db.$executeRawUnsafe(
      "ALTER TABLE BudgetPeriod DROP COLUMN reconciliationAdjustment"
    );
    await db.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name IN ('20261028090000_integrate_reconciliation_budget','20261028100000_fixed_envelope_versions')`;
  } else if (process.argv[2] === "verify") {
    const user = await db.utilisateur.findUniqueOrThrow({ where: { email } });
    const charge = await db.operationFixe.findFirstOrThrow({
      where: { userId: user.id },
    });
    assert.strictEqual(charge.montant.toFixed(2), "300.01");
    assert.strictEqual(charge.isBudgetEnvelope, false);
    const period = await db.budgetPeriod.findFirstOrThrow({
      where: { userId: user.id },
    });
    assert.strictEqual(period.realRemaining.toFixed(2), "500.00");
    assert.strictEqual(period.revision, 7);
    assert.strictEqual(period.reconciliationAdjustment.toFixed(2), "0.00");
    assert.strictEqual(await db.fixedOperationVersion.count(), 0);
    await clean();
    console.log(
      "New integration/opt-in migrations preserve old amounts and closed snapshots, opt-out by default, empty version history"
    );
  } else throw new Error("Expected prepare/verify");
}
run()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
