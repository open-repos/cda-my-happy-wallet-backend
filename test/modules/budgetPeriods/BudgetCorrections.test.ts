import assert from "assert";
import { PrismaClient, TypeOperationFixeEnum } from "@prisma/client";
import {
  BudgetCorrectionService,
  BudgetPeriodEngine,
} from "../../../src/modules/budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { OneOffOperationUseCases } from "../../../src/modules/operations/application";
import {
  PrismaOneOffOperationRepository,
  PrismaOperationCategoryRepository,
} from "../../../src/modules/operations/infrastructure";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error("Correction tests require the disposable test database.");
}

const prisma = new PrismaClient();
const emails = [
  "correction-owner@example.test",
  "correction-other@example.test",
];
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

const serviceTests = async () => {
  const calls: Array<[string, string]> = [];
  const service = new BudgetCorrectionService(
    {
      recalculateFrom: async (_owner, month, currency) => {
        calls.push([currency, month]);
      },
    },
    () => TODAY
  );
  await service.afterOperationChange(1, [
    { operationDate: "2026-09-12", currency: "EUR" },
    { operationDate: "2026-07-01", currency: "EUR" },
    { operationDate: "2026-10-01", currency: "USD" },
    { operationDate: "2026-12-01", currency: "GBP" },
    { operationDate: "2026-08-31", currency: "USD" },
  ]);
  // Une seule passe par devise, depuis son mois passé le plus ancien.
  assert.deepStrictEqual(calls, [
    ["EUR", "2026-07"],
    ["USD", "2026-08"],
  ]);
};

const run = async () => {
  await serviceTests();
  await cleanDatabase();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          firstname: "Correction",
          lastname: "Test",
          email,
          password: "not-a-real-password",
        },
      })
    )
  );
  const category = await prisma.operationCategory.create({
    data: { name: "Corrections", userId: owner.id },
  });
  const otherCategory = await prisma.operationCategory.create({
    data: { name: "Corrections", userId: other.id },
  });
  await prisma.operationFixe.createMany({
    data: [owner, other].flatMap((user) => [
      {
        titre: "Salaire",
        montant: "1500.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.REVENU,
        userId: user.id,
      },
      {
        titre: "Loyer",
        montant: "500.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.CHARGE,
        userId: user.id,
      },
    ]),
  });

  const repository = new PrismaBudgetPeriodRepository(prisma);
  const engine = new BudgetPeriodEngine(repository);
  const categories = new PrismaOperationCategoryRepository(prisma);
  const operations = new OneOffOperationUseCases(
    new PrismaOneOffOperationRepository(prisma),
    categories,
    new BudgetCorrectionService(engine, () => TODAY)
  );
  const write = (
    date: string,
    amount: string,
    currency = "EUR",
    userId = owner.id
  ) =>
    operations.create(userId, {
      title: `Dépense ${date}`,
      amount,
      currency,
      kind: "DEPENSE",
      operationDate: date,
      categoryId: userId === owner.id ? category.id : otherCategory.id,
    });
  const chain = async (userId = owner.id) =>
    (
      await prisma.budgetPeriod.findMany({
        where: { userId, currency: "EUR" },
        orderBy: { periodStart: "asc" },
      })
    ).map((period) => [
      period.periodStart.toISOString().slice(0, 7),
      period.carryIn.toFixed(2),
      period.status === "CLOSED" ? period.realRemaining.toFixed(2) : "open",
    ]);

  // Chaîne initiale : juin −120, juillet 880, août 1 880, septembre 2 580.
  await write("2026-06-10", "1120.00");
  await write("2026-10-02", "50.00");
  await engine.summarize(owner.id, "2026-10", "EUR", TODAY);
  await engine.summarize(other.id, "2026-10", "EUR", TODAY);
  const otherBefore = await chain(other.id);
  assert.deepStrictEqual(await chain(), [
    ["2026-06", "0.00", "-120.00"],
    ["2026-07", "-120.00", "880.00"],
    ["2026-08", "880.00", "1880.00"],
    ["2026-09", "1880.00", "2880.00"],
    ["2026-10", "2880.00", "open"],
  ]);

  // Dépense oubliée en juillet : juillet corrigé, reports propagés.
  const forgotten = await write("2026-07-20", "100.00");
  assert.deepStrictEqual(await chain(), [
    ["2026-06", "0.00", "-120.00"],
    ["2026-07", "-120.00", "780.00"],
    ["2026-08", "780.00", "1780.00"],
    ["2026-09", "1780.00", "2780.00"],
    ["2026-10", "2780.00", "open"],
  ]);
  const july = await repository.find(owner.id, "2026-07", "EUR");
  assert.ok(july?.correctedAt instanceof Date);
  assert.strictEqual(july?.revision, 3);
  assert.strictEqual(
    (await repository.find(owner.id, "2026-06", "EUR"))?.correctedAt,
    null
  );
  const october = await engine.summarize(owner.id, "2026-10", "EUR", TODAY);
  assert.strictEqual(october.budget.carryInMinorUnits, 278000);
  assert.strictEqual(october.budget.realRemainingMinorUnits, 373000);

  // Déplacement vers septembre et nouveau montant : les deux mois sont recalculés.
  await operations.update(owner.id, forgotten.id!, {
    title: "Dépense déplacée",
    amount: "40.00",
    currency: "EUR",
    kind: "DEPENSE",
    operationDate: "2026-09-03",
    categoryId: category.id,
  });
  assert.deepStrictEqual((await chain()).slice(1, 5), [
    ["2026-07", "-120.00", "880.00"],
    ["2026-08", "880.00", "1880.00"],
    ["2026-09", "1880.00", "2840.00"],
    ["2026-10", "2840.00", "open"],
  ]);

  // Changement de devise : la chaîne EUR retrouve son état initial.
  await operations.update(owner.id, forgotten.id!, {
    title: "Dépense déplacée",
    amount: "40.00",
    currency: "USD",
    kind: "DEPENSE",
    operationDate: "2026-09-03",
    categoryId: category.id,
  });
  assert.deepStrictEqual((await chain())[3], ["2026-09", "1880.00", "2880.00"]);

  // Suppression d'une dépense d'un mois clôturé.
  const removable = await write("2026-08-05", "30.00");
  assert.deepStrictEqual((await chain())[2], ["2026-08", "880.00", "1850.00"]);
  await operations.delete(owner.id, removable.id!);
  assert.deepStrictEqual((await chain())[2], ["2026-08", "880.00", "1880.00"]);

  // Saisie antérieure à l'origine : la chaîne repart d'avril, mai est matérialisé.
  await write("2026-04-15", "1000.00");
  const rebuilt = await chain();
  // Avril : socle 1 000 − 1 000 = 0; mai sans saisie : +1 000; juin 1 000 − 120.
  assert.deepStrictEqual(rebuilt.slice(0, 3), [
    ["2026-04", "0.00", "0.00"],
    ["2026-05", "0.00", "1000.00"],
    ["2026-06", "1000.00", "880.00"],
  ]);
  assert.deepStrictEqual(rebuilt[rebuilt.length - 1], [
    "2026-10",
    "3880.00",
    "open",
  ]);

  // Écritures concurrentes dans le même mois clôturé : aucun total perdu.
  await Promise.all([
    write("2026-08-10", "11.00"),
    write("2026-08-11", "22.00"),
  ]);
  const august = await repository.find(owner.id, "2026-08", "EUR");
  assert.strictEqual(august?.actualExpenseMinorUnits, 3300);
  const september = await repository.find(owner.id, "2026-09", "EUR");
  assert.strictEqual(
    september?.carryInMinorUnits,
    august?.realRemainingMinorUnits
  );
  const lastOctober = await engine.summarize(owner.id, "2026-10", "EUR", TODAY);
  assert.strictEqual(
    lastOctober.budget.carryInMinorUnits,
    (await repository.find(owner.id, "2026-09", "EUR"))?.realRemainingMinorUnits
  );

  // Le mois courant n'est jamais recalculé : il est lu en direct.
  const revisionBefore = (await repository.find(owner.id, "2026-10", "EUR"))
    ?.revision;
  await write("2026-10-05", "5.00");
  assert.strictEqual(
    (await repository.find(owner.id, "2026-10", "EUR"))?.revision,
    revisionBefore
  );

  // Isolation : l'autre utilisateur n'est pas touché.
  assert.deepStrictEqual(await chain(other.id), otherBefore);
};

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
