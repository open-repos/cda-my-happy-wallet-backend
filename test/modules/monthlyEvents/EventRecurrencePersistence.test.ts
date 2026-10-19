import assert from "assert";
import { PrismaClient } from "@prisma/client";
import {
  MonthlyEvent,
  MonthlyEventOccurrence,
} from "../../../src/modules/monthlyEvents/domain";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { PrismaOccurrenceResolutionRepository } from "../../../src/modules/eventOccurrences/infrastructure";
import { EventOccurrenceUseCases } from "../../../src/modules/eventOccurrences/application";
import { PrismaOperationCategoryRepository } from "../../../src/modules/operations/infrastructure";

const url = process.env.DATABASE_URL ?? "";
if (
  process.env.NODE_ENV !== "test" ||
  !url.includes("my-happy-wallet-mysql-test") ||
  !url.includes("myhappywallet_test")
) {
  throw new Error(
    "Recurrence persistence tests require the disposable test database."
  );
}
const prisma = new PrismaClient();
const emails = [
  "recurrence-owner@example.test",
  "recurrence-other@example.test",
];
const clean = () =>
  prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });

const run = async () => {
  await clean();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          email,
          firstname: "Recurrence",
          lastname: "Test",
          password: "test-only",
        },
      })
    )
  );
  const events = new PrismaMonthlyEventRepository(prisma);
  const periods = new PrismaBudgetPeriodRepository(prisma);
  const resolutions = new PrismaOccurrenceResolutionRepository(prisma);
  const rules: MonthlyEvent[] = [];
  for (const [recurrence, startDate, endDate] of [
    ["HEBDOMADAIRE", "2024-01-26", "2024-03-08"],
    ["TRIMESTRIELLE", "2024-01-31", "2025-01-31"],
    ["ANNUELLE", "2024-02-29", "2028-02-29"],
    ["MENSUELLE", "2024-01-31", "2028-02-29"],
    ["AUCUNE", "2024-02-15", null],
  ] as const)
    rules.push(
      await events.create(
        MonthlyEvent.create({
          ownerId: owner.id,
          title: recurrence,
          amount: "10.01",
          currency: "EUR",
          kind: "DEPENSE",
          recurrence,
          startDate,
          endDate,
        })
      )
    );
  await events.create(
    MonthlyEvent.create({
      ownerId: other.id,
      title: "Autre propriétaire",
      amount: "99.00",
      currency: "EUR",
      kind: "DEPENSE",
      recurrence: "HEBDOMADAIRE",
      startDate: "2024-01-26",
    })
  );
  const usd = await events.create(
    MonthlyEvent.create({
      ownerId: owner.id,
      title: "Autre devise",
      amount: "99.00",
      currency: "USD",
      kind: "ENTREE",
      recurrence: "HEBDOMADAIRE",
      startDate: "2024-01-26",
    })
  );

  for (const month of [
    "2024-01",
    "2024-02",
    "2024-03",
    "2024-04",
    "2025-02",
    "2028-02",
    "2028-03",
  ]) {
    const expected = [...rules, usd]
      .flatMap((event) =>
        event
          .occurrencesIn(month)
          .map((occurrenceDate) => ({ event, occurrenceDate }))
      )
      .sort(
        (a, b) =>
          a.occurrenceDate.localeCompare(b.occurrenceDate) ||
          a.event.id! - b.event.id!
      );
    const actual: MonthlyEventOccurrence[] = [];
    let cursor: string | null = null;
    do {
      const page = await events.listOccurrences(owner.id, month, {
        limit: 2,
        cursor,
      });
      actual.push(...page.data);
      cursor = page.meta.nextCursor;
    } while (cursor !== null);
    assert.deepStrictEqual(
      actual.map((item) => [item.event.id, item.occurrenceDate]),
      expected.map((item) => [item.event.id, item.occurrenceDate]),
      month
    );
    assert.ok(actual.every((item) => item.event.ownerId === owner.id));
    const planned = await periods.plannedMovements(owner.id, month, "EUR");
    const expectedEur = expected.filter(
      (item) => item.event.currency === "EUR"
    );
    assert.strictEqual(
      planned.reduce((sum, item) => sum + item.count, 0),
      expectedEur.length
    );
    assert.strictEqual(
      planned.reduce((sum, item) => sum + item.minorUnits, 0),
      expectedEur.length * 1001
    );
    assert.ok(planned.length <= 62);
  }
  const pending = await resolutions.listPending(
    owner.id,
    "2024-02-01",
    "2024-02-29",
    { limit: 100, cursor: null }
  );
  const expectedPending = [...rules, usd]
    .flatMap((event) =>
      event
        .occurrencesIn("2024-02")
        .map((occurrenceDate) => ({ id: event.id!, occurrenceDate }))
    )
    .sort(
      (a, b) => a.occurrenceDate.localeCompare(b.occurrenceDate) || a.id - b.id
    );
  assert.deepStrictEqual(
    pending.data.map((item) => [item.sourceEventId, item.occurrenceDate]),
    expectedPending.map((item) => [item.id, item.occurrenceDate])
  );
  // Traverse pending cursors across repeated occurrences of the same weekly rule.
  const paged: string[] = [];
  let pendingCursor: string | null = null;
  do {
    const page = await resolutions.listPending(
      owner.id,
      "2024-02-01",
      "2024-02-29",
      { limit: 2, cursor: pendingCursor }
    );
    paged.push(
      ...page.data.map((item) => `${item.sourceEventId}/${item.occurrenceDate}`)
    );
    pendingCursor = page.meta.nextCursor;
  } while (pendingCursor !== null);
  assert.deepStrictEqual(
    paged,
    expectedPending.map((item) => `${item.id}/${item.occurrenceDate}`)
  );

  const category = await prisma.operationCategory.create({
    data: { userId: owner.id, name: "Récurrence" },
  });
  const useCases = new EventOccurrenceUseCases(
    events,
    new PrismaOperationCategoryRepository(prisma),
    periods,
    resolutions,
    () => "2024-02-01"
  );
  for (const [event, date] of [
    [rules[0], "2024-02-09"],
    [rules[2], "2024-02-29"],
    [rules[1], "2024-04-30"],
  ] as const) {
    const before = await periods.plannedMovements(
      owner.id,
      date.slice(0, 7),
      "EUR"
    );
    const beforeTotal = before.reduce((sum, item) => sum + item.minorUnits, 0);
    await useCases.realize(owner.id, event.id!, date, {
      categoryId: category.id,
      operationDate: "2024-02-20",
    });
    assert.strictEqual(
      (
        await useCases.realize(owner.id, event.id!, date, {
          categoryId: category.id,
          operationDate: "2024-02-20",
        })
      ).replayed,
      true
    );
    assert.strictEqual(
      (
        await periods.plannedMovements(owner.id, date.slice(0, 7), "EUR")
      ).reduce((sum, item) => sum + item.minorUnits, 0),
      beforeTotal - 1001
    );
  }
  await useCases.cancel(owner.id, rules[0].id!, "2024-02-16");
  const after = await resolutions.listPending(
    owner.id,
    "2024-02-01",
    "2024-02-29",
    { limit: 100, cursor: null }
  );
  assert.strictEqual(after.data.length, expectedPending.length - 3);
  await assert.rejects(useCases.cancel(other.id, rules[0].id!, "2024-02-23"));
  assert.strictEqual(
    (await periods.actualMovements(owner.id, "2024-02", "EUR")).length,
    3
  );
  assert.strictEqual(
    (await periods.actualMovements(other.id, "2024-02", "EUR")).length,
    0
  );
};

run()
  .finally(async () => {
    await clean();
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
