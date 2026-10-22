import assert from "assert";
import { FixedChargePeriodicity, PrismaClient } from "@prisma/client";
import { OperationFixeRepo } from "../../../src/modules/operationsFixes/operationFixeRepo";
import { loadFixedTotals } from "../../../src/modules/operationsFixes/infrastructure/loadFixedTotals";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Fixed charge tests require the disposable myhappywallet_test database."
  );
}
const prisma = new PrismaClient();
const emails = [
  "fixed-charge-owner@example.test",
  "fixed-charge-other@example.test",
];
async function clean() {
  const users = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  await prisma.operationFixe.deleteMany({ where: { userId: { in: ids } } });
  await prisma.resteAVivre.deleteMany({ where: { userId: { in: ids } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: ids } } });
}
async function run() {
  await clean();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          email,
          firstname: "Fixed",
          lastname: "Test",
          password: "not-a-real-password",
        },
      })
    )
  );
  const repository = new OperationFixeRepo(prisma);
  const periods = new PrismaBudgetPeriodRepository(prisma);
  const engine = new BudgetPeriodEngine(periods);
  await repository.create(
    { titre: "Salaire", montant: 1000, devise: "EUR" },
    String(owner.id),
    "REVENU"
  );
  const charge = await repository.create(
    {
      titre: "Abonnement annuel",
      montant: 120,
      devise: "EUR",
      periodicite: "ANNUELLE",
      pourcentagePersonnel: 50,
    },
    String(owner.id),
    "CHARGE"
  );
  assert.strictEqual(charge.montantMensuelPersonnel, "5.00");
  const persisted = await prisma.operationFixe.findUniqueOrThrow({
    where: { idOperationFixe: charge.idOperationFixe },
  });
  assert.strictEqual(persisted.montant.toFixed(2), "120.00");
  assert.strictEqual(persisted.pourcentagePersonnel.toFixed(2), "50.00");
  await repository.create(
    { titre: "Autre propriétaire", montant: 999, devise: "EUR" },
    String(other.id),
    "CHARGE"
  );
  await repository.create(
    { titre: "Autre devise", montant: 888, devise: "USD" },
    String(owner.id),
    "CHARGE"
  );
  // SQL sums each rounded personal monthly amount, irrespective of page size.
  for (let i = 0; i < 2; i++) {
    await repository.create(
      {
        titre: "Demi-centime",
        montant: 0.01,
        devise: "EUR",
        pourcentagePersonnel: 50,
      },
      String(owner.id),
      "CHARGE"
    );
  }
  const read = await repository.getAllCharges(String(owner.id), "CHARGE", {
    limit: 1,
    cursor: null,
  });
  assert.strictEqual(read.data.length, 1);
  assert.strictEqual(read.meta.hasNext, true);
  assert.deepStrictEqual(await periods.fixedTotals(owner.id, "EUR"), {
    incomeMinorUnits: 100000,
    expenseMinorUnits: 502,
  });
  const month = await engine.summarize(
    owner.id,
    "2026-10",
    "EUR",
    "2026-10-22"
  );
  assert.strictEqual(month.period.fixedExpenseMinorUnits, 502);
  assert.strictEqual(month.budget.realRemainingMinorUnits, 99498);
  await repository.update(
    {
      id: charge.idOperationFixe,
      titre: "Nouveau total",
      montant: 240,
      devise: "EUR",
    },
    String(owner.id),
    String(charge.idOperationFixe),
    "CHARGE"
  );
  const updated = await repository.read(
    { id: charge.idOperationFixe },
    String(owner.id),
    String(charge.idOperationFixe),
    "CHARGE"
  );
  assert.strictEqual(updated[0].periodicite, "ANNUELLE");
  assert.strictEqual(updated[0].pourcentagePersonnel, 50);
  assert.strictEqual(updated[0].montantMensuelPersonnel, "10.00");
  const refreshed = await engine.summarize(
    owner.id,
    "2026-10",
    "EUR",
    "2026-10-22"
  );
  assert.strictEqual(refreshed.period.fixedExpenseMinorUnits, 1002);
  const closed = await engine.summarize(
    owner.id,
    "2026-10",
    "EUR",
    "2026-11-01"
  );
  assert.strictEqual(closed.period.status, "CLOSED");
  await repository.update(
    {
      id: charge.idOperationFixe,
      titre: "Ma nouvelle part",
      montant: 240,
      devise: "EUR",
      pourcentagePersonnel: 40,
    },
    String(owner.id),
    String(charge.idOperationFixe),
    "CHARGE"
  );
  const november = await engine.summarize(
    owner.id,
    "2026-11",
    "EUR",
    "2026-11-01"
  );
  assert.strictEqual(november.period.fixedExpenseMinorUnits, 802);
  const projection = await new BudgetForecastService(periods).forecast(
    owner.id,
    "2026-11",
    2,
    "EUR",
    "2026-11-01"
  );
  assert.deepStrictEqual(
    projection.months.map((month) => month.fixedExpenseMinorUnits),
    [802, 802]
  );
  const frozen = await periods.find(owner.id, "2026-10", "EUR");
  assert.strictEqual(frozen?.status, "CLOSED");
  assert.strictEqual(frozen?.fixedExpenseMinorUnits, 1002);
  const wrongType = await repository.update(
    {
      id: charge.idOperationFixe,
      titre: "Interdit",
      montant: 500,
      devise: "EUR",
    },
    String(owner.id),
    String(charge.idOperationFixe),
    "REVENU"
  );
  assert.strictEqual(wrongType.count, 0);
  const wrongOwner = await repository.delete(
    {
      id: charge.idOperationFixe,
      titre: "Interdit",
      montant: 500,
      devise: "EUR",
    },
    String(other.id),
    String(charge.idOperationFixe),
    "CHARGE"
  );
  assert.strictEqual(wrongOwner.count, 0);
  for (const periodicite of Object.values(FixedChargePeriodicity)) {
    for (const pourcentagePersonnel of [100, 50, 40]) {
      await repository.create(
        {
          titre: "Matrice SQL",
          montant: 1200,
          devise: "EUR",
          periodicite,
          pourcentagePersonnel,
        },
        String(other.id),
        "CHARGE"
      );
    }
  }
  assert.deepStrictEqual(await periods.fixedTotals(other.id, "EUR"), {
    incomeMinorUnits: 0,
    expenseMinorUnits: 574900,
  });
  assert.deepStrictEqual(await loadFixedTotals(prisma, owner.id), {
    incomeMinorUnits: 100000,
    expenseMinorUnits: 89602,
  });
  await repository.createRaV(String(owner.id));
  const legacy = await prisma.resteAVivre.findFirstOrThrow({
    where: { userId: owner.id },
  });
  // Retained legacy storage: no currency filter and Decimal(10,0), unlike
  // current budget-period snapshots, which retain the cents asserted above.
  assert.strictEqual(legacy.montantTotalDepense.toFixed(2), "896.00");
  assert.strictEqual(
    await prisma.evenementMensuel.count({ where: { userId: owner.id } }),
    0
  );
  assert.strictEqual(
    await prisma.oneOffOperationRecord.count({ where: { userId: owner.id } }),
    0
  );
  console.log(
    "Fixed charge MySQL persistence, SQL rounding and budget snapshot tests passed"
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
