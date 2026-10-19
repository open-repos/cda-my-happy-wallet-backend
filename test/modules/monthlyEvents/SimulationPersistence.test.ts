import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { MonthlyEvent } from "../../../src/modules/monthlyEvents/domain";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { SavingsCapacityService } from "../../../src/modules/financialGoals/application/SavingsCapacityService";
import { PrismaOccurrenceResolutionRepository } from "../../../src/modules/eventOccurrences/infrastructure";
import { EventOccurrenceUseCases } from "../../../src/modules/eventOccurrences/application";
import { expirePotentialEvents } from "../../../src/modules/monthlyEvents/infrastructure/potentialEventMaintenance";

const url = process.env.DATABASE_URL ?? "";
if (
  process.env.NODE_ENV !== "test" ||
  !url.includes("my-happy-wallet-mysql-test") ||
  !url.includes("myhappywallet_test")
)
  throw new Error(
    "Simulation persistence tests require the disposable test database"
  );
const prisma = new PrismaClient();
const emails = [
  "simulation-owner@example.test",
  "simulation-other@example.test",
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
          firstname: "Simulation",
          lastname: "Test",
          password: "test-only",
        },
      })
    )
  );
  let today = "2026-10-31";
  const clock = () => today;
  const events = new PrismaMonthlyEventRepository(prisma, undefined, clock);
  const periods = new PrismaBudgetPeriodRepository(prisma, undefined, clock);
  const resolutions = new PrismaOccurrenceResolutionRepository(
    prisma,
    undefined,
    clock
  );
  const create = (
    ownerId: number,
    startDate: string,
    status: "CONFIRME" | "POTENTIEL" = "POTENTIEL"
  ) =>
    events.create(
      MonthlyEvent.create({
        ownerId,
        title: "Simulation event",
        amount: "50.00",
        currency: "EUR",
        kind: "DEPENSE",
        startDate,
        recurrence: "MENSUELLE",
        status,
      })
    );
  const confirmed = await create(owner.id, "2026-09-30", "CONFIRME");
  const current = await create(owner.id, "2026-10-31");
  const future = await create(owner.id, "2026-11-30");
  const foreign = await create(other.id, "2026-10-31");
  const page = { limit: 1, cursor: null };
  assert.deepStrictEqual(
    (await events.listByOwner(owner.id, { limit: 100, cursor: null })).data.map(
      (event) => event.id
    ),
    [confirmed.id]
  );
  const firstPotential = await events.listByOwner(owner.id, page, "POTENTIEL");
  assert.ok(firstPotential.meta.nextCursor);
  await assert.rejects(
    events.listByOwner(owner.id, {
      ...page,
      cursor: firstPotential.meta.nextCursor,
    })
  );
  assert.strictEqual(
    (
      await events.listByOwner(
        owner.id,
        { ...page, cursor: firstPotential.meta.nextCursor },
        "POTENTIEL"
      )
    ).data[0].id,
    future.id
  );
  const occurrencePage = await events.listOccurrences(
    owner.id,
    "2026-10",
    page,
    "simulation"
  );
  assert.ok(occurrencePage.meta.nextCursor);
  await assert.rejects(
    events.listOccurrences(owner.id, "2026-10", {
      ...page,
      cursor: occurrencePage.meta.nextCursor,
    })
  );
  const normalPlanned = await periods.plannedMovements(
    owner.id,
    "2026-10",
    "EUR"
  );
  const simulationPlanned = await periods.plannedMovements(
    owner.id,
    "2026-10",
    "EUR",
    "simulation"
  );
  assert.strictEqual(
    normalPlanned.reduce((sum, row) => sum + row.minorUnits, 0),
    5000
  );
  assert.strictEqual(
    simulationPlanned.reduce((sum, row) => sum + row.minorUnits, 0),
    10000
  );
  assert.strictEqual(
    (
      await resolutions.listPending(owner.id, "2026-10-01", "2026-10-31", {
        limit: 100,
        cursor: null,
      })
    ).data.length,
    1
  );
  const engine = new BudgetPeriodEngine(periods);
  const normal = await engine.summarize(owner.id, "2026-10", "EUR", today);
  const simulation = await engine.summarize(
    owner.id,
    "2026-10",
    "EUR",
    today,
    "simulation"
  );
  assert.strictEqual(
    normal.budget.realRemainingMinorUnits,
    simulation.budget.realRemainingMinorUnits
  );
  assert.strictEqual(
    normal.forecast!.forecastRemainingMinorUnits -
      simulation.forecast!.forecastRemainingMinorUnits,
    5000
  );
  const forecast = new BudgetForecastService(periods);
  const capacity = new SavingsCapacityService(forecast, {
    listForSavingsCapacity: async () => [],
  });
  const standard = await capacity.calculate(
    owner.id,
    "2026-10",
    2,
    "EUR",
    today
  );
  const simulated = await capacity.calculate(
    owner.id,
    "2026-10",
    2,
    "EUR",
    today,
    "simulation"
  );
  assert.deepStrictEqual(
    standard.months.map(
      (month, i) =>
        month.beforeGoalsMinorUnits - simulated.months[i].beforeGoalsMinorUnits
    ),
    [5000, 15000]
  );
  const useCases = new EventOccurrenceUseCases(
    events,
    { findById: async () => null } as never,
    periods,
    resolutions,
    clock
  );
  await assert.rejects(
    useCases.cancel(owner.id, current.id!, "2026-10-31"),
    (error: any) => error.code === "EVENT_NOT_CONFIRMED"
  );
  await assert.rejects(
    useCases.realize(owner.id, current.id!, "2026-10-31", {
      categoryId: 1,
      operationDate: "2026-10-31",
    }),
    (error: any) => error.code === "EVENT_NOT_CONFIRMED"
  );
  assert.strictEqual(await events.confirm(current.id!, other.id), null);
  // A legacy stray resolution must be deleted with its expired potential series.
  await prisma.eventOccurrenceResolution.create({
    data: {
      userId: owner.id,
      sourceEventId: current.id!,
      occurrenceDate: new Date("2026-10-31T00:00:00Z"),
      title: current.title,
      amount: "50.00",
      currency: "EUR",
      kind: "DEPENSE",
      status: "CANCELED",
    },
  });
  assert.strictEqual(await expirePotentialEvents(prisma, owner.id, today), 0);
  today = "2026-11-01";
  await periods.plannedMovements(owner.id, "2026-11", "EUR", "simulation");
  assert.strictEqual(await events.findById(current.id!, owner.id), null);
  assert.strictEqual(
    await prisma.eventOccurrenceResolution.count({
      where: { userId: owner.id, sourceEventId: current.id },
    }),
    0
  );
  assert.strictEqual(await expirePotentialEvents(prisma, owner.id, today), 0);
  assert.ok(await events.findById(confirmed.id!, owner.id));
  assert.ok(await events.findById(future.id!, owner.id));
  assert.ok(
    await prisma.evenementMensuel.findUnique({ where: { id: foreign.id } })
  );
  const before = await events.findById(future.id!, owner.id);
  const promoted = await events.confirm(future.id!, owner.id);
  assert.strictEqual(promoted!.status, "CONFIRME");
  assert.strictEqual(promoted!.startDate, before!.startDate);
  assert.strictEqual(promoted!.minorUnits, before!.minorUnits);
  assert.strictEqual(
    (await events.confirm(future.id!, owner.id))!.status,
    "CONFIRME"
  );
  const removable = await create(owner.id, "2026-12-01");
  // A read as the other owner may expire that owner's old rule, but must
  // preserve its current-month potential when the first owner clears theirs.
  await create(other.id, "2026-11-30");
  assert.strictEqual(await events.delete(removable.id!, other.id), false);
  assert.strictEqual(await events.delete(removable.id!, owner.id), true);
  await create(owner.id, "2026-12-01");
  await events.clearPotential(owner.id);
  await events.clearPotential(owner.id);
  assert.strictEqual(
    await prisma.evenementMensuel.count({
      where: { userId: owner.id, status: "POTENTIEL" },
    }),
    0
  );
  assert.strictEqual(
    await prisma.evenementMensuel.count({ where: { userId: other.id } }),
    1
  );
  assert.strictEqual(
    await prisma.evenementMensuel.count({
      where: { userId: owner.id, status: "CONFIRME" },
    }),
    2
  );
  // Each concerned read must perform expiry independently, not depend on a
  // previous event-list request. The requested forecast month does not matter.
  const readers: Array<(id: number) => Promise<unknown>> = [
    () =>
      events.listByOwner(owner.id, { limit: 10, cursor: null }, "POTENTIEL"),
    () =>
      events.listOccurrences(
        owner.id,
        "2026-12",
        { limit: 10, cursor: null },
        "simulation"
      ),
    (id) => events.findById(id, owner.id),
    () =>
      resolutions.listPending(owner.id, "2026-11-01", "2026-11-30", {
        limit: 10,
        cursor: null,
      }),
    (id) => resolutions.find(owner.id, id, "2026-10-01"),
    () => periods.plannedMovements(owner.id, "2026-12", "EUR"),
    (id) => events.confirm(id, owner.id),
  ];
  for (const read of readers) {
    const expired = await create(owner.id, "2026-10-01");
    await prisma.eventOccurrenceResolution.create({
      data: {
        userId: owner.id,
        sourceEventId: expired.id!,
        occurrenceDate: new Date("2026-10-01T00:00:00Z"),
        title: expired.title,
        amount: "50.00",
        currency: "EUR",
        kind: "DEPENSE",
        status: "CANCELED",
      },
    });
    await read(expired.id!);
    assert.strictEqual(
      await prisma.evenementMensuel.count({ where: { id: expired.id } }),
      0
    );
    assert.strictEqual(
      await prisma.eventOccurrenceResolution.count({
        where: { userId: owner.id, sourceEventId: expired.id },
      }),
      0
    );
  }
  // A confirmation started before the Paris month boundary races with expiry:
  // either deletion wins, or the now-confirmed rule survives permanently.
  const raced = await create(owner.id, "2026-10-31");
  const beforeBoundary = new PrismaMonthlyEventRepository(
    prisma,
    undefined,
    () => "2026-10-31"
  );
  const [raceConfirmation] = await Promise.all([
    beforeBoundary.confirm(raced.id!, owner.id),
    expirePotentialEvents(prisma, owner.id, "2026-11-01"),
  ]);
  const raceResult = await prisma.evenementMensuel.findUnique({
    where: { id: raced.id },
  });
  if (raceConfirmation === null) assert.strictEqual(raceResult, null);
  else assert.strictEqual(raceResult!.status, "CONFIRME");
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
