import assert from "assert";
import { PrismaClient, TypeOperationFixeEnum } from "@prisma/client";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error("Carry-over tests require the disposable test database.");
}

const prisma = new PrismaClient();
const emails = ["carry-owner@example.test", "carry-other@example.test"];
const TODAY = "2026-10-11";

const cleanDatabase = async () => {
  const users = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  await prisma.oneOffOperationRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationCategory.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationFixe.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: userIds } } });
};

const run = async () => {
  await cleanDatabase();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          firstname: "Carry",
          lastname: "Over",
          email,
          password: "not-a-real-password",
        },
      })
    )
  );
  const category = await prisma.operationCategory.create({
    data: { name: "Carry", userId: owner.id },
  });
  // Socle de 1 000 € par mois.
  await prisma.operationFixe.createMany({
    data: [
      {
        titre: "Salaire",
        montant: "1500.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.REVENU,
        userId: owner.id,
      },
      {
        titre: "Loyer",
        montant: "500.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.CHARGE,
        userId: owner.id,
      },
      {
        titre: "Autre",
        montant: "999.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.REVENU,
        userId: other.id,
      },
    ],
  });
  const expense = (date: string, amount: string, currency = "EUR") => ({
    title: `Dépense ${date}`,
    amount,
    currency,
    type: "DEPENSE" as const,
    operationDate: new Date(`${date}T00:00:00.000Z`),
    userId: owner.id,
    categoryId: category.id,
  });
  // Juin : premier mois d'activité, −1 120 € de dépenses → reste −120 €.
  // Juillet et août : aucune saisie. Septembre : 300 €. Octobre : 50 €.
  await prisma.oneOffOperationRecord.createMany({
    data: [
      expense("2026-06-10", "1120.00"),
      expense("2026-09-15", "300.00"),
      expense("2026-10-02", "50.00"),
      expense("2026-10-03", "10.00", "USD"),
    ],
  });

  const repository = new PrismaBudgetPeriodRepository(prisma);
  const engine = new BudgetPeriodEngine(repository);

  assert.strictEqual(
    await repository.firstActivityMonth(owner.id, "EUR"),
    "2026-06"
  );
  assert.strictEqual(
    await repository.firstActivityMonth(other.id, "EUR"),
    null
  );

  const october = await engine.summarize(owner.id, "2026-10", "EUR", TODAY);
  // Juin −120; juillet +880; août +1 880; septembre +2 580; octobre +3 530.
  assert.strictEqual(october.carryFromMonth, "2026-09");
  assert.strictEqual(october.budget.carryInMinorUnits, 258000);
  assert.strictEqual(october.budget.monthResultMinorUnits, 95000);
  assert.strictEqual(october.budget.realRemainingMinorUnits, 353000);
  assert.ok(october.forecast != null);
  assert.strictEqual(october.forecast.forecastRemainingMinorUnits, 353000);

  // Les mois sans saisie ont été matérialisés et clôturés pour la continuité.
  const periods = await prisma.budgetPeriod.findMany({
    where: { userId: owner.id, currency: "EUR" },
    orderBy: { periodStart: "asc" },
  });
  assert.deepStrictEqual(
    periods.map((period) => [
      period.periodStart.toISOString().slice(0, 7),
      period.status,
      period.carryIn.toFixed(2),
      period.realRemaining.toFixed(2),
    ]),
    [
      ["2026-06", "CLOSED", "0.00", "-120.00"],
      ["2026-07", "CLOSED", "-120.00", "880.00"],
      ["2026-08", "CLOSED", "880.00", "1880.00"],
      ["2026-09", "CLOSED", "1880.00", "2580.00"],
      ["2026-10", "OPEN", "2580.00", "0.00"],
    ]
  );

  // Le déficit de juin pèse sur juillet.
  const july = await engine.summarize(owner.id, "2026-07", "EUR", TODAY);
  assert.strictEqual(july.carryFromMonth, "2026-06");
  assert.strictEqual(july.budget.carryInMinorUnits, -12000);
  assert.strictEqual(july.budget.monthResultMinorUnits, 100000);
  assert.strictEqual(july.forecast, null);

  // Premier mois et mois antérieurs : aucun report.
  const june = await engine.summarize(owner.id, "2026-06", "EUR", TODAY);
  assert.strictEqual(june.carryFromMonth, null);
  assert.strictEqual(june.budget.carryInMinorUnits, 0);
  assert.strictEqual(june.budget.balanceStatus, "NEGATIVE");
  const may = await engine.summarize(owner.id, "2026-05", "EUR", TODAY);
  assert.strictEqual(may.carryFromMonth, null);
  assert.strictEqual(may.budget.carryInMinorUnits, 0);
  const juneAgain = await engine.summarize(owner.id, "2026-06", "EUR", TODAY);
  assert.strictEqual(juneAgain.period.carryInMinorUnits, 0);

  // Isolation par devise et propriétaire.
  const usd = await engine.summarize(owner.id, "2026-10", "USD", TODAY);
  assert.strictEqual(usd.carryFromMonth, null);
  assert.strictEqual(usd.budget.carryInMinorUnits, 0);
  const foreign = await engine.summarize(other.id, "2026-10", "EUR", TODAY);
  assert.strictEqual(foreign.budget.carryInMinorUnits, 0);
  assert.strictEqual(foreign.budget.realRemainingMinorUnits, 99900);

  // Relecture : aucun recalcul ni double comptage du report.
  const again = await engine.summarize(owner.id, "2026-10", "EUR", TODAY);
  assert.strictEqual(again.budget.realRemainingMinorUnits, 353000);
  assert.strictEqual(
    await prisma.budgetPeriod.count({
      where: { userId: owner.id, currency: "EUR" },
    }),
    6
  );

  // Le mois suivant reprend le reste réel d'octobre une fois clôturé.
  const november = await engine.summarize(
    owner.id,
    "2026-11",
    "EUR",
    "2026-11-02"
  );
  assert.strictEqual(november.carryFromMonth, "2026-10");
  assert.strictEqual(november.budget.carryInMinorUnits, 353000);
};

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
