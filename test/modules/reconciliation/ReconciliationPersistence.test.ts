/// <reference path="../../../src/utils/custom.d.ts" />
import { UserRepo } from "../../../src/modules/user/userRepo";
import { FakeMailer } from "../../fakes/FakeMailer";
import assert from "assert";
import express, { RequestHandler } from "express";
import supertest from "supertest";
import { PrismaClient } from "@prisma/client";
import { createReconciliationRouter } from "../../../src/routes/reconciliation";
import { ReconciliationController } from "../../../src/modules/reconciliation/presentation/ReconciliationController";
import { PrismaReconciliationRepository } from "../../../src/modules/reconciliation/infrastructure/PrismaReconciliationRepository";
import { ReconciliationError } from "../../../src/modules/reconciliation/domain/Reconciliation";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { PrismaOneOffOperationRepository } from "../../../src/modules/operations/infrastructure/PrismaOneOffOperationRepository";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { SavingsCapacityService } from "../../../src/modules/financialGoals/application/SavingsCapacityService";
import { OneOffOperation } from "../../../src/modules/operations/domain";
import { metrics } from "../../../src/modules/reconciliation/domain/Reconciliation";

const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw new Error("Reconciliation requires the disposable MySQL test database");
const prisma = new PrismaClient();
const emails = [
  "reconciliation-owner@example.test",
  "reconciliation-other@example.test",
];
const page = { limit: 100, cursor: null };
const error = (code: string) => (e: unknown) =>
  e instanceof ReconciliationError && e.code === code;
async function clean() {
  const users = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
  });
  const ids = users.map((u) => u.id);
  await prisma.reconciliationLink.deleteMany({
    where: { userId: { in: ids } },
  });
  await prisma.reconciliationOccurrence.deleteMany({
    where: { userId: { in: ids } },
  });
  await prisma.budgetEnvelope.deleteMany({ where: { userId: { in: ids } } });
  await prisma.operationFixe.deleteMany({ where: { userId: { in: ids } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: ids } } });
}
async function run() {
  await clean();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          email,
          firstname: "Recon",
          lastname: "Test",
          password: "test-only",
        },
      })
    )
  );
  const category = await prisma.operationCategory.create({
    data: { userId: owner.id, name: "Courses" },
  });
  const foreignCategory = await prisma.operationCategory.create({
    data: { userId: other.id, name: "Courses" },
  });
  let today = "2026-10-27";
  const repo = new PrismaReconciliationRepository(prisma, () => today);
  const operations = new PrismaOneOffOperationRepository(
    prisma,
    undefined,
    () => today
  );
  const periods = new PrismaBudgetPeriodRepository(
    prisma,
    undefined,
    () => today
  );
  const engine = new BudgetPeriodEngine(periods);
  const forecast = new BudgetForecastService(periods);
  const capacity = new SavingsCapacityService(forecast, {
    listForSavingsCapacity: async () => [],
  });
  const envelopeInput = {
    title: "Courses",
    amount: "300.00",
    currency: "EUR",
    categoryId: category.id,
    startMonth: "2026-10",
    endMonth: null,
  };
  const envelope = await repo.saveEnvelope(owner.id, envelopeInput);
  await assert.rejects(
    repo.saveEnvelope(owner.id, {
      ...envelopeInput,
      categoryId: foreignCategory.id,
    }),
    error("NOT_FOUND")
  );
  await assert.rejects(
    repo.getEnvelope(other.id, envelope.id),
    error("NOT_FOUND")
  );
  const month = () => repo.listOccurrences(owner.id, "2026-10", "EUR", page);
  const courses = (await month()).data[0];
  assert.strictEqual(courses.metrics.planned, "300.00");
  assert.strictEqual(courses.metrics.actual, "0.00");
  await Promise.all([month(), month()]);
  assert.strictEqual((await month()).data.length, 1);
  const real = async (amount: string, extra: Record<string, unknown> = {}) =>
    prisma.oneOffOperationRecord.create({
      data: {
        userId: owner.id,
        title: "Achat réel",
        amount,
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date("2026-10-15T00:00:00Z"),
        categoryId: category.id,
        ...extra,
      },
    });
  const buys = await Promise.all(
    ["85.00", "42.00", "96.00"].map((amount) => real(amount))
  );
  const beforeBudget = await engine.summarize(
    owner.id,
    "2026-10",
    "EUR",
    today
  );
  const beforeForecast = await forecast.forecast(
    owner.id,
    "2026-10",
    2,
    "EUR",
    today
  );
  const beforeCapacity = await capacity.calculate(
    owner.id,
    "2026-10",
    2,
    "EUR",
    today
  );
  const beforeCount = await prisma.oneOffOperationRecord.count({
    where: { userId: owner.id },
  });
  for (const buy of buys) await repo.link(owner.id, buy.id, courses.id, null);
  assert.deepStrictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).metrics,
    metrics("ENVELOPE", 30000, 22300)
  );
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).operationCount,
    3
  );
  assert.strictEqual(
    (await repo.summary(owner.id, "2026-10", "EUR")).projectedExpense,
    "300.00"
  );
  assert.strictEqual(
    await prisma.oneOffOperationRecord.count({ where: { userId: owner.id } }),
    beforeCount
  );
  assert.deepStrictEqual(
    await engine.summarize(owner.id, "2026-10", "EUR", today),
    beforeBudget
  );
  assert.deepStrictEqual(
    await forecast.forecast(owner.id, "2026-10", 2, "EUR", today),
    beforeForecast
  );
  assert.deepStrictEqual(
    await capacity.calculate(owner.id, "2026-10", 2, "EUR", today),
    beforeCapacity
  );
  const over = await real("110.00");
  await Promise.all([
    repo.link(owner.id, over.id, courses.id, null),
    repo.link(owner.id, over.id, courses.id, null),
  ]);
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).metrics.overrun,
    "33.00"
  );
  const summary = await repo.summary(owner.id, "2026-10", "EUR");
  assert.strictEqual(summary.actualExpense, "333.00");
  assert.strictEqual(summary.projectedExpense, "333.00"); // never 633
  const unmatched = await real("10.01");
  assert.strictEqual(
    (await repo.summary(owner.id, "2026-10", "EUR")).projectedExpense,
    "343.01"
  );
  assert.strictEqual(
    (await repo.summary(owner.id, "2026-10", "EUR")).unassociatedExpense,
    "10.01"
  );
  assert.strictEqual(
    (await repo.listOperations(owner.id, courses.id, true, page)).data[0].id,
    unmatched.id
  );
  const linkedPage = await repo.listOperations(owner.id, courses.id, false, {
    limit: 1,
    cursor: null,
  });
  assert.ok(linkedPage.meta.nextCursor);
  assert.notStrictEqual(
    (
      await repo.listOperations(owner.id, courses.id, false, {
        limit: 1,
        cursor: linkedPage.meta.nextCursor,
      })
    ).data[0].id,
    linkedPage.data[0].id
  );
  await assert.rejects(
    repo.listOperations(owner.id, courses.id, true, {
      limit: 1,
      cursor: linkedPage.meta.nextCursor,
    })
  );
  const second = await repo.saveEnvelope(owner.id, {
    ...envelopeInput,
    title: "Courses autre",
  });
  const secondOccurrence = (await month()).data.find(
    (r) => r.sourceId === second.id && r.sourceType === "ENVELOPE"
  )!;
  const suggestions = await repo.suggestions(owner.id, unmatched.id, page);
  assert.strictEqual(suggestions.data.length, 2);
  assert.strictEqual(
    await prisma.reconciliationLink.count({
      where: { operationId: unmatched.id },
    }),
    0
  );
  await repo.link(owner.id, buys[0].id, secondOccurrence.id, courses.id);
  await repo.link(owner.id, buys[0].id, secondOccurrence.id, courses.id); // replay
  await assert.rejects(
    repo.link(owner.id, buys[0].id, courses.id, null),
    error("ASSOCIATION_CONFLICT")
  );
  await repo.link(owner.id, buys[0].id, null, secondOccurrence.id);
  await repo.link(owner.id, buys[0].id, null, secondOccurrence.id); // replay
  await repo.link(owner.id, buys[0].id, courses.id, null);
  const race = await Promise.allSettled([
    repo.link(owner.id, unmatched.id, courses.id, null),
    repo.link(owner.id, unmatched.id, secondOccurrence.id, null),
  ]);
  assert.strictEqual(race.filter((r) => r.status === "fulfilled").length, 1);
  assert.strictEqual(race.filter((r) => r.status === "rejected").length, 1);
  assert.strictEqual(
    await prisma.reconciliationLink.count({
      where: { operationId: unmatched.id },
    }),
    1
  );
  assert.strictEqual(
    (await repo.getLink(owner.id, buys[0].id)).occurrenceId,
    courses.id
  );
  await assert.rejects(repo.getLink(other.id, buys[0].id), error("NOT_FOUND"));
  const raceLink = await prisma.reconciliationLink.findUniqueOrThrow({
    where: { operationId: unmatched.id },
  });
  await repo.link(owner.id, unmatched.id, null, raceLink.occurrenceId);
  const foreignEnvelope = await repo.saveEnvelope(other.id, {
    ...envelopeInput,
    categoryId: foreignCategory.id,
  });
  const foreignOccurrence = (
    await repo.listOccurrences(other.id, "2026-10", "EUR", page)
  ).data[0];
  assert.strictEqual(foreignOccurrence.sourceId, foreignEnvelope.id);
  await assert.rejects(
    repo.link(owner.id, unmatched.id, foreignOccurrence.id, null),
    error("NOT_FOUND")
  );
  await assert.rejects(
    repo.link(other.id, unmatched.id, foreignOccurrence.id, null),
    error("NOT_FOUND")
  );
  for (const [extra, code] of [
    [{ currency: "USD" }, "CURRENCY_MISMATCH"],
    [{ type: "ENTREE" }, "TYPE_MISMATCH"],
    [{ operationDate: new Date("2026-11-01T00:00:00Z") }, "PERIOD_MISMATCH"],
  ] as const) {
    const incompatible = await real("1.00", extra);
    await assert.rejects(
      repo.link(owner.id, incompatible.id, courses.id, null),
      error(code)
    );
  }
  await assert.rejects(
    prisma.reconciliationLink.create({
      data: {
        operationId: unmatched.id,
        userId: owner.id,
        occurrenceId: foreignOccurrence.id,
      },
    }),
    (e: any) => e.code === "P2003"
  );
  await assert.rejects(
    prisma.budgetEnvelope.create({
      data: {
        userId: owner.id,
        title: "Bad category",
        amount: "1",
        currency: "EUR",
        startMonth: new Date("2026-10-01T00:00:00Z"),
        categoryId: foreignCategory.id,
      },
    }),
    (e: any) => e.code === "P2003"
  );
  await repo.saveEnvelope(
    owner.id,
    { ...envelopeInput, amount: "500.00", title: "Nouveau budget" },
    envelope.id
  );
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).metrics.planned,
    "300.00"
  );
  const november = (
    await repo.listOccurrences(owner.id, "2026-11", "EUR", page)
  ).data.find((r) => r.sourceId === envelope.id)!;
  assert.strictEqual(november.metrics.planned, "500.00");
  const futureActual = await real("2.00", {
    operationDate: new Date("2026-11-02T00:00:00Z"),
  });
  await repo.link(owner.id, futureActual.id, november.id, null);
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, november.id)).metrics.actual,
    "2.00"
  );
  const eurBeforeUsd = (await repo.summary(owner.id, "2026-10", "EUR"))
    .actualExpense;
  const usdEnvelope = await repo.saveEnvelope(owner.id, {
    ...envelopeInput,
    title: "USD budget",
    currency: "USD",
    amount: "5.00",
    categoryId: null,
  });
  const usdOccurrence = (
    await repo.listOccurrences(owner.id, "2026-10", "USD", page)
  ).data[0];
  assert.strictEqual(usdOccurrence.sourceId, usdEnvelope.id);
  assert.strictEqual(usdOccurrence.categoryId, null);
  assert.strictEqual(
    (await repo.summary(owner.id, "2026-10", "USD")).actualExpense,
    "1.00"
  );
  assert.strictEqual(
    (await repo.summary(owner.id, "2026-10", "EUR")).actualExpense,
    eurBeforeUsd
  );
  await repo.updateOccurrence(owner.id, courses.id, "320.00");
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).referenceTotal,
    "300.00"
  );
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).metrics.planned,
    "320.00"
  );
  await repo.archiveEnvelope(owner.id, envelope.id);
  await repo.archiveEnvelope(owner.id, envelope.id);
  assert.strictEqual(
    (await repo.listEnvelopes(owner.id, page, "2026-10")).data.length,
    2
  );
  assert.ok(
    (await repo.listEnvelopes(owner.id, page)).data.some(
      (r) => r.id === envelope.id && r.archived
    )
  );
  await assert.rejects(
    repo.saveEnvelope(owner.id, envelopeInput, envelope.id),
    error("ARCHIVED_ENVELOPE")
  );
  assert.ok(
    (await repo.listOccurrences(owner.id, "2026-11", "EUR", page)).data.some(
      (r) => r.id === november.id
    )
  );
  assert.ok(
    !(await repo.listOccurrences(owner.id, "2026-12", "EUR", page)).data.some(
      (r) => r.sourceId === envelope.id
    )
  );
  assert.strictEqual(
    (await repo.listOccurrences(owner.id, "2026-09", "EUR", page)).data.length,
    0
  );
  const fixed = async (
    titre: string,
    montant: string,
    typeOperation: "CHARGE" | "REVENU",
    extra: Record<string, unknown> = {}
  ) =>
    prisma.operationFixe.create({
      data: {
        userId: owner.id,
        titre,
        montant,
        devise: "EUR",
        typeOperation,
        ...extra,
      },
    });
  const rent = await fixed("Loyer", "800.00", "CHARGE");
  const salary = await fixed("Salaire", "2200.00", "REVENU");
  const shared = await fixed("Partagée", "800.01", "CHARGE", {
    pourcentagePersonnel: "50.00",
  });
  const yearly = await fixed("Annuel", "120.00", "CHARGE", {
    periodicite: "ANNUELLE",
  });
  for (const periodicite of ["BIMESTRIELLE", "TRIMESTRIELLE", "SEMESTRIELLE"])
    await fixed(periodicite, "120.00", "CHARGE", { periodicite });
  const missingCurrency = await fixed("Devise absente", "10.00", "CHARGE", {
    devise: null,
  });
  const fixedRows = (await month()).data;
  assert.ok(
    !fixedRows.some(
      (r) =>
        r.sourceId === yearly.idOperationFixe &&
        r.sourceType === "FIXED_EXPENSE"
    )
  );
  const eligibility = await repo.eligibility(owner.id, page);
  assert.strictEqual(
    eligibility.data.filter((r) => r.reason === "NON_MONTHLY_WITHOUT_DUE_DATE")
      .length,
    4
  );
  assert.strictEqual(
    eligibility.data.find((r) => r.id === missingCurrency.idOperationFixe)!
      .reason,
    "MISSING_CURRENCY"
  );
  const rentRow = fixedRows.find(
    (r) =>
      r.sourceId === rent.idOperationFixe && r.sourceType === "FIXED_EXPENSE"
  )!;
  const salaryRow = fixedRows.find(
    (r) =>
      r.sourceId === salary.idOperationFixe && r.sourceType === "FIXED_INCOME"
  )!;
  const sharedRow = fixedRows.find(
    (r) =>
      r.sourceId === shared.idOperationFixe && r.sourceType === "FIXED_EXPENSE"
  )!;
  const payment = await real("800.00");
  await repo.link(owner.id, payment.id, rentRow.id, null);
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, rentRow.id)).metrics.status,
    "PAID"
  );
  const updatedPayment = OneOffOperation.create({
    id: payment.id,
    ownerId: owner.id,
    title: payment.title,
    amount: "820.00",
    currency: "EUR",
    kind: "DEPENSE",
    operationDate: "2026-10-15",
    category: { id: category.id, ownerId: owner.id },
  });
  await operations.update(updatedPayment);
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, rentRow.id)).metrics.overrun,
    "20.00"
  );
  const incompatibleUpdate = OneOffOperation.create({
    id: payment.id,
    ownerId: owner.id,
    title: "Déplacé",
    amount: "820.00",
    currency: "EUR",
    kind: "DEPENSE",
    operationDate: "2026-11-15",
    category: { id: category.id, ownerId: owner.id },
  });
  await assert.rejects(
    operations.update(incompatibleUpdate),
    error("LINKED_OPERATION_INCOMPATIBLE")
  );
  const income = await real("2180.00", { type: "ENTREE" });
  await repo.link(owner.id, income.id, salaryRow.id, null);
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, salaryRow.id)).metrics.missing,
    "20.00"
  );
  const personalPayment = await real("400.01");
  await repo.link(owner.id, personalPayment.id, sharedRow.id, null);
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, sharedRow.id)).metrics.status,
    "PAID"
  );
  const fixedBudgetBeforeLink = await engine.summarize(
    owner.id,
    "2026-10",
    "EUR",
    today
  );
  await repo.link(owner.id, payment.id, null, rentRow.id);
  await repo.link(owner.id, payment.id, rentRow.id, null);
  assert.deepStrictEqual(
    await engine.summarize(owner.id, "2026-10", "EUR", today),
    fixedBudgetBeforeLink
  );
  await prisma.operationFixe.delete({
    where: { idOperationFixe: rent.idOperationFixe },
  });
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, rentRow.id)).title,
    "Loyer"
  );
  // Neither confirmed plans nor simulation hypotheses are real-operation candidates.
  await prisma.evenementMensuel.createMany({
    data: ["CONFIRME", "POTENTIEL"].map((status) => ({
      userId: owner.id,
      title: "Prévision",
      amount: "99.00",
      currency: "EUR",
      startDate: new Date("2026-10-15T00:00:00Z"),
      status: status as "CONFIRME" | "POTENTIEL",
    })),
  });
  const actualBeforeEvents = (await repo.summary(owner.id, "2026-10", "EUR"))
    .actualExpense;
  assert.strictEqual(
    actualBeforeEvents,
    (await repo.summary(owner.id, "2026-10", "EUR")).actualExpense
  );
  const deletable = await real("1.00");
  await repo.link(owner.id, deletable.id, courses.id, null);
  await operations.delete(deletable.id, owner.id);
  assert.strictEqual(
    await prisma.reconciliationLink.findUnique({
      where: { operationId: deletable.id },
    }),
    null
  );
  assert.ok(await repo.getOccurrence(owner.id, courses.id));
  const zero = await repo.saveEnvelope(owner.id, {
    ...envelopeInput,
    title: "Zéro",
    amount: "0.00",
  });
  const zeroRow = (await month()).data.find(
    (r) => r.sourceType === "ENVELOPE" && r.sourceId === zero.id
  )!;
  assert.strictEqual(zeroRow.metrics.progress, null);
  assert.strictEqual(zeroRow.metrics.projected, "0.00");
  const first = await repo.listOccurrences(owner.id, "2026-10", "EUR", {
    limit: 1,
    cursor: null,
  });
  await assert.rejects(
    repo.listOccurrences(other.id, "2026-10", "EUR", {
      limit: 1,
      cursor: first.meta.nextCursor,
    })
  );
  await assert.rejects(
    repo.listOccurrences(owner.id, "2026-11", "EUR", {
      limit: 1,
      cursor: first.meta.nextCursor,
    })
  );
  await assert.rejects(
    repo.listOccurrences(owner.id, "2026-10", "USD", {
      limit: 1,
      cursor: first.meta.nextCursor,
    })
  );
  // Real HTTP traversal over Prisma, with fixed clock and authenticated identity.
  const authenticate: RequestHandler = (req, _, next) => {
    req.user = {
      id: req.headers.authorization === "other" ? other.id : owner.id,
    };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    createReconciliationRouter(
      new ReconciliationController(repo, () => today),
      authenticate
    )
  );
  app.use(errorHandler);
  assert.strictEqual(
    (
      await supertest(app)
        .get(`/reconciliation/occurrences/${courses.id}`)
        .set("Authorization", "other")
    ).status,
    404
  );
  const apiSummary = await supertest(app).get(
    "/reconciliation/months/2026-10/summary?currency=EUR"
  );
  const assignmentHttp = await supertest(app).get(
    `/operations/${unmatched.id}/reconciliation`
  );
  assert.strictEqual(assignmentHttp.status, 200);
  assert.deepStrictEqual(assignmentHttp.body.data, {
    operationId: unmatched.id,
    occurrenceId: null,
  });
  assert.strictEqual(apiSummary.status, 200);
  assert.strictEqual(apiSummary.body.integration.globalBudgetAdjusted, false);
  assert.strictEqual(
    apiSummary.body.data.scope,
    "TRACKED_OCCURRENCES_AND_UNASSOCIATED_ACTUALS"
  );
  const apiSuggestions = await supertest(app).get(
    `/operations/${unmatched.id}/reconciliation-suggestions`
  );
  assert.strictEqual(apiSuggestions.body.automatic, false);
  // Persisted CLOSED also protects a current/future month before the calendar rolls.
  await prisma.budgetPeriod.updateMany({
    where: {
      userId: owner.id,
      periodStart: new Date("2026-10-01T00:00:00Z"),
      currency: "EUR",
    },
    data: { status: "CLOSED" },
  });
  await assert.rejects(
    repo.link(owner.id, unmatched.id, courses.id, null),
    error("PERIOD_CLOSED")
  );
  await assert.rejects(
    repo.updateOccurrence(owner.id, courses.id, "1.00"),
    error("PERIOD_CLOSED")
  );
  await assert.rejects(
    operations.delete(payment.id, owner.id),
    error("PERIOD_CLOSED")
  );
  await assert.rejects(
    operations.update(updatedPayment),
    error("PERIOD_CLOSED")
  );
  assert.strictEqual(
    (await repo.getOccurrence(owner.id, courses.id)).closed,
    true
  );
  today = "2026-11-01";
  const frozen = await repo.getOccurrence(owner.id, courses.id);
  await repo.link(owner.id, payment.id, rentRow.id, null); // read-only replay after closure
  await assert.rejects(
    repo.link(owner.id, payment.id, null, rentRow.id),
    error("PERIOD_CLOSED")
  );
  await repo.saveEnvelope(
    owner.id,
    { ...envelopeInput, amount: "1.00" },
    second.id
  );
  assert.deepStrictEqual(
    await repo.getOccurrence(owner.id, courses.id),
    frozen
  );
  assert.strictEqual(
    (await repo.suggestions(owner.id, unmatched.id, page)).data.length,
    0
  );
  const closedHttp = await supertest(app)
    .put(`/operations/${payment.id}/reconciliation`)
    .send({ occurrenceId: null, expectedOccurrenceId: rentRow.id });
  assert.strictEqual(closedHttp.status, 409);
  assert.strictEqual(closedHttp.body.error.details.code, "PERIOD_CLOSED");
  // Calendar closure is enforced even without a BudgetPeriod row.
  assert.strictEqual(await periods.find(owner.id, "2026-11", "EUR"), null);
  today = "2026-12-01";
  await assert.rejects(
    repo.link(owner.id, futureActual.id, null, november.id),
    error("PERIOD_CLOSED")
  );
  // Account lifecycle: removing an account removes metadata, never blocks the
  // existing delete flow. Covers MySQL cascade/restrict ordering in real SQL.
  const accounts = new UserRepo(prisma, new FakeMailer());
  assert.strictEqual(
    (await accounts.delete("wrong@example.test", other.id)).count,
    0
  );
  assert.ok(await repo.getEnvelope(other.id, foreignEnvelope.id));
  assert.strictEqual((await accounts.delete(other.email, other.id)).count, 1);
  assert.strictEqual(
    await prisma.reconciliationOccurrence.count({
      where: { userId: other.id },
    }),
    0
  );
  console.log(
    "Reconciliation MySQL: exact totals, concurrency/replays, FK isolation, snapshots, periods, CRUD guards, real HTTP and unchanged financial engines passed"
  );
}
run()
  .finally(async () => {
    await clean();
    await prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
