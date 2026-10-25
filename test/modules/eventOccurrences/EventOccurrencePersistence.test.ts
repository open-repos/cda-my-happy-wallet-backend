import assert from "assert";
import { PrismaClient, TypeOperationFixeEnum } from "@prisma/client";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { EventOccurrenceUseCases } from "../../../src/modules/eventOccurrences/application";
import { OccurrenceResolutionError } from "../../../src/modules/eventOccurrences/domain";
import { PrismaOccurrenceResolutionRepository } from "../../../src/modules/eventOccurrences/infrastructure";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";
import { PrismaOperationCategoryRepository } from "../../../src/modules/operations/infrastructure";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Event occurrence persistence tests require the disposable test database."
  );
}

const prisma = new PrismaClient();
const emails = [
  "occurrence-owner@example.test",
  "occurrence-other@example.test",
];
const TODAY = "2026-10-11";

const cleanDatabase = async () => {
  const users = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  await prisma.eventOccurrenceResolution.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.oneOffOperationRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationCategory.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.utilisateur.deleteMany({ where: { id: { in: userIds } } });
};

const createUser = (email: string) =>
  prisma.utilisateur.create({
    data: {
      firstname: "Occurrence",
      lastname: "Owner",
      email,
      password: "not-a-real-password",
    },
  });

const explainUses = async (
  index: string,
  sql: string,
  ...values: unknown[]
) => {
  const plan = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    `EXPLAIN FORMAT=JSON ${sql}`,
    ...values
  );
  assert.ok(
    Object.values(plan[0] ?? {}).some((value) => value.includes(index)),
    `${index} is not a candidate for ${sql}`
  );
};

const run = async () => {
  await cleanDatabase();
  const user = await createUser(emails[0]);
  const other = await createUser(emails[1]);
  const category = await prisma.operationCategory.create({
    data: { name: "Occurrences", userId: user.id },
  });
  await prisma.operationFixe.createMany({
    data: [
      {
        titre: "Salaire",
        montant: "2000.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.REVENU,
        userId: user.id,
      },
      {
        titre: "Charges",
        montant: "800.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.CHARGE,
        userId: user.id,
      },
    ],
  });
  const event = (
    title: string,
    amount: string,
    startDate: string,
    extra = {}
  ) =>
    prisma.evenementMensuel.create({
      data: {
        title,
        amount,
        currency: "EUR",
        kind: "DEPENSE",
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        recurrence: "MENSUELLE",
        userId: user.id,
        ...extra,
      },
    });
  const rent = await event("Loyer", "300.00", "2026-01-05");
  const gym = await event("Sport", "20.00", "2026-01-15");
  await event("Prime", "50.00", "2026-10-20", {
    kind: "ENTREE",
    recurrence: "AUCUNE",
  });
  await event("Dollar", "99.00", "2026-01-15", { currency: "USD" });
  await prisma.evenementMensuel.create({
    data: {
      title: "Autre",
      amount: "999.00",
      currency: "EUR",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      recurrence: "MENSUELLE",
      userId: other.id,
    },
  });
  await prisma.objectifFinancier.createMany({
    data: [
      {
        title: "Vacances",
        targetAmount: "1200.00",
        savedAmount: "300.00",
        monthlyContribution: "150.00",
        currency: "EUR",
        userId: user.id,
      },
      {
        title: "Atteint",
        targetAmount: "100.00",
        savedAmount: "100.00",
        monthlyContribution: "40.00",
        currency: "EUR",
        userId: user.id,
      },
      {
        title: "Sans versement",
        targetAmount: "500.00",
        savedAmount: "0",
        monthlyContribution: "0",
        currency: "EUR",
        userId: user.id,
      },
      {
        title: "Autre devise",
        targetAmount: "500.00",
        savedAmount: "0",
        monthlyContribution: "70.00",
        currency: "USD",
        userId: user.id,
      },
    ],
  });

  const periods = new PrismaBudgetPeriodRepository(prisma);
  const resolutions = new PrismaOccurrenceResolutionRepository(prisma);
  const useCases = new EventOccurrenceUseCases(
    new PrismaMonthlyEventRepository(prisma),
    new PrismaOperationCategoryRepository(prisma),
    periods,
    resolutions,
    () => TODAY
  );
  const engine = new BudgetPeriodEngine(periods);

  const before = await engine.summarize(user.id, "2026-10", "EUR", TODAY);
  assert.ok(before.forecast != null);
  // Réel 1 200 €; planifié −300 −20 +50; épargne −150 (seul objectif actif EUR).
  assert.strictEqual(before.budget.realRemainingMinorUnits, 120000);
  assert.strictEqual(before.forecast.plannedExpenseMinorUnits, 32000);
  assert.strictEqual(before.forecast.plannedIncomeMinorUnits, 5000);
  assert.strictEqual(before.forecast.goalSavingsMinorUnits, 15000);
  assert.strictEqual(before.forecast.forecastRemainingMinorUnits, 78000);
  assert.strictEqual(before.forecast.unresolvedCount, 3);
  assert.strictEqual(before.forecast.overdueCount, 1);

  // Deux réalisations concurrentes identiques : une seule opération.
  const command = { categoryId: category.id, amount: "287.90" };
  const results = await Promise.all([
    useCases.realize(user.id, rent.id, "2026-10-05", command),
    useCases.realize(user.id, rent.id, "2026-10-05", command),
  ]);
  assert.deepStrictEqual(results.map((result) => result.replayed).sort(), [
    false,
    true,
  ]);
  assert.strictEqual(
    await prisma.oneOffOperationRecord.count({ where: { userId: user.id } }),
    1
  );

  // Réalisation et annulation concurrentes : une seule décision gagne.
  const contested = await Promise.allSettled([
    useCases.realize(user.id, gym.id, "2026-10-15", {
      categoryId: category.id,
    }),
    useCases.cancel(user.id, gym.id, "2026-10-15"),
  ]);
  assert.strictEqual(
    contested.filter((result) => result.status === "fulfilled").length,
    1
  );
  const loser = contested.find((result) => result.status === "rejected");
  assert.ok(
    loser?.status === "rejected" &&
      loser.reason instanceof OccurrenceResolutionError &&
      loser.reason.code === "OCCURRENCE_ALREADY_RESOLVED"
  );
  const gymDecision = await resolutions.find(user.id, gym.id, "2026-10-15");
  const gymRealized = gymDecision?.status === "REALIZED" ? 2000 : 0;

  const after = await engine.summarize(user.id, "2026-10", "EUR", TODAY);
  assert.ok(after.forecast != null);
  // Le loyer réel (287,90 €) remplace sa prévision (300 €) sans double comptage.
  assert.strictEqual(
    after.budget.realRemainingMinorUnits,
    120000 - 28790 - gymRealized
  );
  assert.strictEqual(after.forecast.plannedExpenseMinorUnits, 0);
  assert.strictEqual(after.forecast.unresolvedCount, 1);
  assert.strictEqual(
    after.forecast.forecastRemainingMinorUnits,
    120000 - 28790 - gymRealized + 5000 - 15000
  );

  // Isolation : l'autre utilisateur ne voit ni ne résout ces occurrences.
  await assert.rejects(useCases.cancel(other.id, rent.id, "2026-11-05"));
  assert.strictEqual(
    (await periods.plannedMovements(other.id, "2026-10", "EUR")).length,
    1
  );

  // Clôture : septembre garde ses deux occurrences EUR sans décision.
  const september = await engine.summarize(user.id, "2026-09", "EUR", TODAY);
  assert.strictEqual(september.period.status, "CLOSED");
  assert.strictEqual(september.period.unresolvedEvents, 2);
  assert.strictEqual(september.forecast, null);

  // Suppression de la règle : la décision et l'opération sont conservées.
  await prisma.evenementMensuel.delete({ where: { id: rent.id } });
  const kept = await resolutions.find(user.id, rent.id, "2026-10-05");
  assert.strictEqual(kept?.status, "REALIZED");
  assert.strictEqual(kept?.title, "Loyer");
  const replayAfterDeletion = await useCases.realize(
    user.id,
    rent.id,
    "2026-10-05",
    command
  );
  assert.strictEqual(replayAfterDeletion.replayed, true);

  // Suppression de l'opération : la décision reste, le lien devient null.
  await prisma.oneOffOperationRecord.delete({
    where: { id: kept!.operation!.id },
  });
  const unlinked = await resolutions.find(user.id, rent.id, "2026-10-05");
  assert.strictEqual(unlinked?.status, "REALIZED");
  assert.strictEqual(unlinked?.operation, null);

  // Read decisions after deletion, beyond one page, and on the linked real date.
  await prisma.eventOccurrenceResolution.createMany({
    data: Array.from({ length: 103 }, (_, i) => ({
      userId: user.id,
      sourceEventId: 200000 + i,
      occurrenceDate: new Date("2026-10-25T00:00:00Z"),
      status: "CANCELED" as const,
      title: "Pagination",
      amount: "1.00",
      currency: "EUR",
      kind: "DEPENSE" as const,
    })),
  });
  const linkedOperation = await prisma.oneOffOperationRecord.create({
    data: {
      userId: user.id,
      categoryId: category.id,
      title: "Date réelle différente",
      amount: "75.00",
      currency: "EUR",
      type: "DEPENSE",
      operationDate: new Date("2026-11-01T00:00:00Z"),
    },
  });
  await prisma.eventOccurrenceResolution.create({
    data: {
      userId: user.id,
      sourceEventId: 300000,
      occurrenceDate: new Date("2026-10-25T00:00:00Z"),
      status: "REALIZED",
      title: "Prévision originale",
      amount: "100.00",
      currency: "EUR",
      kind: "DEPENSE",
      operationId: linkedOperation.id,
    },
  });
  const collected = [];
  let cursor: string | null = null;
  do {
    const result = await resolutions.listResolved(
      user.id,
      "2026-10-01",
      "2026-10-31",
      { limit: 20, cursor }
    );
    collected.push(...result.data);
    cursor = result.meta.nextCursor;
  } while (cursor);
  assert.strictEqual(
    new Set(collected.map((item) => item.id)).size,
    collected.length
  );
  assert.strictEqual(
    collected.filter(
      (item) => item.sourceEventId >= 200000 && item.sourceEventId < 200103
    ).length,
    103
  );
  assert.ok(
    collected.some(
      (item) =>
        item.sourceEventId === rent.id &&
        item.operation === null &&
        item.status === "REALIZED"
    )
  );
  const otherRows = await resolutions.listResolved(
    other.id,
    "2026-10-01",
    "2026-10-31",
    { limit: 100, cursor: null }
  );
  assert.ok(otherRows.data.every((row) => row.ownerId === other.id));
  assert.ok(otherRows.data.every((row) => row.sourceEventId !== 300000));
  const november = await resolutions.listResolved(
    user.id,
    "2026-11-01",
    "2026-11-01",
    { limit: 100, cursor: null }
  );
  assert.ok(
    november.data.some(
      (row) =>
        row.sourceEventId === 300000 &&
        row.occurrenceDate === "2026-10-25" &&
        row.operation?.id === linkedOperation.id
    )
  );
  const first = await resolutions.listResolved(
    user.id,
    "2026-10-01",
    "2026-10-31",
    { limit: 1, cursor: null }
  );
  assert.ok(first.meta.nextCursor);
  await assert.rejects(
    resolutions.listResolved(other.id, "2026-10-01", "2026-10-31", {
      limit: 1,
      cursor: first.meta.nextCursor,
    })
  );
  await assert.rejects(
    resolutions.listResolved(user.id, "2026-10-02", "2026-10-31", {
      limit: 1,
      cursor: first.meta.nextCursor,
    })
  );

  await explainUses(
    "EventOccurrenceResolution_userId_occurrenceDate_status_id_idx",
    "SELECT `id` FROM `EventOccurrenceResolution` WHERE `userId` = ? AND `occurrenceDate` <= ? AND `status` = 'REALIZED' ORDER BY `occurrenceDate`, `id` LIMIT 51",
    user.id,
    new Date("2026-10-11T00:00:00.000Z")
  );
  await explainUses(
    "EvenementMensuel_userId_startDate_id_idx",
    "SELECT `id` FROM `EvenementMensuel` WHERE `userId` = ? AND `startDate` <= ?",
    user.id,
    new Date("2026-10-31T00:00:00.000Z")
  );

  await prisma.operationFixe.deleteMany({ where: { userId: user.id } });
  await prisma.oneOffOperationRecord.deleteMany({ where: { userId: user.id } });
  await prisma.operationCategory.deleteMany({ where: { userId: user.id } });
  await prisma.utilisateur.delete({ where: { id: user.id } });
  assert.strictEqual(
    await prisma.eventOccurrenceResolution.count({
      where: { userId: user.id },
    }),
    0
  );
};

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
