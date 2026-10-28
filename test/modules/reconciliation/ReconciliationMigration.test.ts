import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw new Error("Migration test requires disposable MySQL");
const prisma = new PrismaClient();
const email = "reconciliation-migration@example.test";
const migration = "20261027120000_add_budget_reconciliation";
async function clean() {
  const user = await prisma.utilisateur.findUnique({ where: { email } });
  if (!user) return;
  await prisma.operationFixe.deleteMany({ where: { userId: user.id } });
  await prisma.utilisateur.delete({ where: { id: user.id } });
}
async function run() {
  if (process.argv[2] === "prepare") {
    await clean();
    // Only the new empty metadata tables are reconstructed in this guarded,
    // disposable database. No financial tables/rows are reset or rewritten.
    assert.strictEqual(await prisma.reconciliationLink.count(), 0);
    assert.strictEqual(await prisma.reconciliationOccurrence.count(), 0);
    assert.strictEqual(await prisma.budgetEnvelope.count(), 0);
    await prisma.$executeRawUnsafe("DROP TABLE ReconciliationLink");
    await prisma.$executeRawUnsafe("DROP TABLE ReconciliationOccurrence");
    await prisma.$executeRawUnsafe("DROP TABLE BudgetEnvelope");
    await prisma.$executeRawUnsafe(
      "DROP INDEX OneOffOperationRecord_id_userId_key ON OneOffOperationRecord"
    );
    await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = ${migration}`;
    const user = await prisma.utilisateur.create({
      data: {
        email,
        password: "test-only",
        firstname: "Migration",
        lastname: "Test",
      },
    });
    const category = await prisma.operationCategory.create({
      data: { userId: user.id, name: "Legacy test" },
    });
    await prisma.oneOffOperationRecord.create({
      data: {
        userId: user.id,
        title: "Legacy actual",
        amount: "12.34",
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date("2026-09-15T00:00:00Z"),
        categoryId: category.id,
      },
    });
    await prisma.operationFixe.create({
      data: {
        userId: user.id,
        titre: "Legacy annual",
        montant: "120.01",
        devise: "EUR",
        periodicite: "ANNUELLE",
        pourcentagePersonnel: "33.33",
      },
    });
    await prisma.budgetPeriod.create({
      data: {
        userId: user.id,
        periodStart: new Date("2026-09-01T00:00:00Z"),
        currency: "EUR",
        status: "CLOSED",
        fixedIncome: "2200.00",
        fixedExpense: "800.01",
        baseAmount: "1399.99",
        actualIncome: "0",
        actualExpense: "12.34",
        realRemaining: "1387.65",
        revision: 7,
      },
    });
  } else if (process.argv[2] === "verify") {
    const user = await prisma.utilisateur.findUniqueOrThrow({
      where: { email },
    });
    const operation = await prisma.oneOffOperationRecord.findFirstOrThrow({
      where: { userId: user.id },
    });
    assert.strictEqual(operation.amount.toFixed(2), "12.34");
    assert.strictEqual(
      operation.operationDate.toISOString().slice(0, 10),
      "2026-09-15"
    );
    assert.strictEqual(operation.type, "DEPENSE");
    const fixed = await prisma.operationFixe.findFirstOrThrow({
      where: { userId: user.id },
    });
    assert.strictEqual(fixed.periodicite, "ANNUELLE");
    assert.strictEqual(fixed.montant.toFixed(2), "120.01");
    assert.strictEqual(fixed.pourcentagePersonnel.toFixed(2), "33.33");
    const snapshot = await new PrismaBudgetPeriodRepository(prisma).find(
      user.id,
      "2026-09",
      "EUR"
    );
    assert.strictEqual(snapshot!.realRemainingMinorUnits, 138765);
    assert.strictEqual(snapshot!.revision, 7);
    assert.strictEqual(snapshot!.status, "CLOSED");
    assert.strictEqual(await prisma.budgetEnvelope.count(), 0);
    assert.strictEqual(await prisma.reconciliationOccurrence.count(), 0);
    assert.strictEqual(await prisma.reconciliationLink.count(), 0);
    const indexes = await prisma.$queryRaw<
      { INDEX_NAME: string }[]
    >`SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ReconciliationOccurrence'`;
    assert.ok(
      indexes.some(
        (i) =>
          i.INDEX_NAME === "ReconciliationOccurrence_userId_month_sourceKey_key"
      )
    );
    await clean();
    console.log(
      "Reconciliation additive migration: existing financial data and closed snapshots preserved, new tables empty, indexes present"
    );
  } else throw new Error("Expected prepare or verify");
}
run()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
