/// <reference path="../../../src/utils/custom.d.ts" />
import { operationFixeRouter } from "../../../src/routes/operationsFixes";
import { JsonWebTokenService } from "../../../src/modules/auth/token/JsonWebTokenService";
import { prisma as apiDatabase } from "../../../src/database";
import { createReconciliationRouter } from "../../../src/routes/reconciliation";
import { ReconciliationController } from "../../../src/modules/reconciliation/presentation/ReconciliationController";
import { EnvelopeReportingController } from "../../../src/modules/reconciliation/presentation/EnvelopeReportingController";
import { PrismaEnvelopeReporting } from "../../../src/modules/reconciliation/infrastructure/PrismaEnvelopeReporting";
import assert from "assert";
import express, { RequestHandler } from "express";
import supertest from "supertest";
import { PrismaClient } from "@prisma/client";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { SavingsCapacityService } from "../../../src/modules/financialGoals/application/SavingsCapacityService";
import { PrismaReconciliationRepository } from "../../../src/modules/reconciliation/infrastructure/PrismaReconciliationRepository";
import {
  PrismaOneOffOperationRepository,
  PrismaOperationCategoryRepository,
} from "../../../src/modules/operations/infrastructure";
import {
  OneOffOperationUseCases,
  OperationCategoryUseCases,
} from "../../../src/modules/operations/application";
import { OneOffOperationController } from "../../../src/modules/operations/presentation";
import { createOneOffOperationRouter } from "../../../src/routes/oneOffOperations";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { createBudgetPeriodRouter } from "../../../src/routes/budgetPeriods";
import { BudgetPeriodController } from "../../../src/modules/budgetPeriods/presentation/BudgetPeriodController";
const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw new Error("Disposable MySQL required");
const db = new PrismaClient();
const emails = [
  "integrated-budget@example.test",
  "integrated-budget-other@example.test",
];
async function clean() {
  const users = await db.utilisateur.findMany({
    where: { email: { in: emails } },
  });
  const userId = { in: users.map((u) => u.id) };
  await db.reconciliationLink.deleteMany({ where: { userId } });
  await db.reconciliationOccurrence.deleteMany({ where: { userId } });
  await db.budgetEnvelope.deleteMany({ where: { userId } });
  await db.operationFixe.deleteMany({ where: { userId } });
  await db.resteAVivre.deleteMany({ where: { userId } });
  await db.resteAVivreFictif.deleteMany({ where: { userId } });
  await db.utilisateur.deleteMany({ where: { id: userId } });
}
async function run() {
  await clean();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      db.utilisateur.create({
        data: {
          email,
          firstname: "Test",
          lastname: "Integration",
          password: "test-only",
        },
      })
    )
  );
  const category = await db.operationCategory.create({
    data: { userId: owner.id, name: "Alimentation" },
  });
  const otherCategory = await db.operationCategory.create({
    data: { userId: other.id, name: "Alimentation" },
  });
  let today = "2026-10-20";
  const clock = () => today;
  const periods = new PrismaBudgetPeriodRepository(db, undefined, clock);
  const engine = new BudgetPeriodEngine(periods);
  const forecast = new BudgetForecastService(periods);
  const capacity = new SavingsCapacityService(forecast, {
    listForSavingsCapacity: async () => [],
  });
  const recon = new PrismaReconciliationRepository(db, clock);
  await db.operationFixe.createMany({
    data: [
      {
        userId: owner.id,
        titre: "Salaire",
        montant: "2000",
        devise: "EUR",
        typeOperation: "REVENU",
      },
      {
        userId: owner.id,
        titre: "Alimentation",
        montant: "300",
        devise: "EUR",
        typeOperation: "CHARGE",
        isBudgetEnvelope: true,
        categoryId: category.id,
      },
    ],
  });
  const page = { limit: 100, cursor: null };
  const occurrences = (
    await recon.listOccurrences(owner.id, "2026-10", "EUR", page)
  ).data;
  const food = occurrences.find((o) => o.sourceType === "ENVELOPE")!;

  const otherEnvelope = await recon.saveEnvelope(other.id, {
    title: "Foreign",
    amount: "100",
    currency: "EUR",
    categoryId: otherCategory.id,
    startMonth: "2026-10",
    endMonth: null,
  });
  const foreign = (
    await recon.listOccurrences(other.id, "2026-10", "EUR", page)
  ).data.find((o) => o.sourceId === otherEnvelope.id)!;
  const operations = new PrismaOneOffOperationRepository(db, undefined, clock);
  const categories = new PrismaOperationCategoryRepository(db);
  const useCases = new OneOffOperationUseCases(operations, categories);
  const authenticate: RequestHandler = (req, _, next) => {
    req.user = { id: owner.id };
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    createOneOffOperationRouter(
      new OneOffOperationController(
        useCases,
        new OperationCategoryUseCases(categories)
      ),
      authenticate
    )
  );
  app.use(
    createBudgetPeriodRouter(
      new BudgetPeriodController(engine, periods, clock),
      authenticate
    )
  );
  app.use(
    createReconciliationRouter(
      new ReconciliationController(recon, clock),
      authenticate,
      new EnvelopeReportingController(
        new PrismaEnvelopeReporting(db, clock),
        clock
      )
    )
  );
  app.use(errorHandler);
  const payload = {
    title: "Courses du calendrier",
    amount: "400.00",
    currency: "EUR",
    kind: "DEPENSE",
    operationDate: "2026-10-15",
    categoryId: category.id,
    reconciliation: { occurrenceId: food.id, expectedOccurrenceId: null },
  };
  const create = (body: object) =>
    supertest(app).post("/operations").send(body);
  const before = await db.oneOffOperationRecord.count({
    where: { userId: owner.id },
  });
  assert.strictEqual(
    (
      await create({
        ...payload,
        reconciliation: {
          occurrenceId: foreign.id,
          expectedOccurrenceId: null,
        },
      })
    ).status,
    404
  );
  assert.strictEqual(
    (await create({ ...payload, currency: "USD" })).status,
    422
  );
  assert.strictEqual(
    (await create({ ...payload, kind: "ENTREE" })).status,
    422
  );
  assert.strictEqual(
    (await create({ ...payload, operationDate: "2026-09-15" })).status,
    422
  );
  assert.strictEqual(
    await db.oneOffOperationRecord.count({ where: { userId: owner.id } }),
    before
  ); // all saves rolled back
  const response = await create(payload);
  assert.strictEqual(response.status, 201, JSON.stringify(response.body));
  const id = response.body.data.id as number;
  assert.strictEqual((await recon.getLink(owner.id, id)).occurrenceId, food.id);
  const summary = await engine.summarize(owner.id, "2026-10", "EUR", today);
  assert.strictEqual(summary.budget.actualExpenseMinorUnits, 40000);
  assert.strictEqual(summary.budget.realRemainingMinorUnits, 160000);
  assert.strictEqual(summary.budget.reconciliationAdjustmentMinorUnits, 30000);
  assert.strictEqual(summary.forecast!.forecastRemainingMinorUnits, 160000);
  const http = await supertest(app).get(
    "/budget-periods/2026-10/summary?currency=EUR"
  );
  assert.strictEqual(http.body.data.realRemaining, "1600.00");
  assert.strictEqual(http.body.data.actualExpense, "400.00");
  assert.strictEqual(http.body.data.reconciliationAdjustment, "300.00");
  const overviewHttp = await supertest(app).get(
    "/envelope-overview?currency=EUR"
  );
  assert.strictEqual(
    overviewHttp.status,
    200,
    JSON.stringify(overviewHttp.body)
  );
  assert.strictEqual(overviewHttp.body.data[0].months[0].actual, "400.00");
  assert.strictEqual(overviewHttp.body.data[0].totals.actual, "400.00");
  const projected = await forecast.forecast(
    owner.id,
    "2026-10",
    2,
    "EUR",
    today
  );
  assert.strictEqual(projected.months[0].forecastRemainingMinorUnits, 160000);
  assert.strictEqual(projected.months[1].forecastRemainingMinorUnits, 330000);
  const futureEnvelope = (
    await recon.listOccurrences(owner.id, "2026-11", "EUR", page)
  ).data.find((o) => o.sourceId === food.sourceId)!;
  const futureLinked = await create({
    ...payload,
    operationDate: "2026-11-15",
    reconciliation: {
      occurrenceId: futureEnvelope.id,
      expectedOccurrenceId: null,
    },
  });
  assert.strictEqual(futureLinked.status, 201);
  assert.strictEqual(
    (await forecast.forecast(owner.id, "2026-10", 2, "EUR", today)).months[1]
      .forecastRemainingMinorUnits,
    320000
  );
  await operations.delete(futureLinked.body.data.id, owner.id);

  assert.strictEqual(
    (await capacity.calculate(owner.id, "2026-10", 2, "EUR", today)).months[0]
      .beforeGoalsMinorUnits,
    160000
  );
  // Creating a second form's operation is the identical API contract.
  const second = await create({
    ...payload,
    title: "Courses onglet opérations",
    amount: "10.00",
  });
  assert.strictEqual(second.status, 201);
  assert.strictEqual(
    (await engine.summarize(owner.id, "2026-10", "EUR", today)).budget
      .realRemainingMinorUnits,
    159000
  );
  const update = (body: object) =>
    supertest(app).put(`/operations/${id}`).send(body);
  const failed = await update({
    ...payload,
    amount: "999.00",
    reconciliation: { occurrenceId: foreign.id, expectedOccurrenceId: food.id },
  });
  assert.strictEqual(failed.status, 404);
  assert.strictEqual(
    (await operations.findById(id, owner.id))!.money.minorUnits,
    40000
  );
  assert.strictEqual((await recon.getLink(owner.id, id)).occurrenceId, food.id);
  const envelope = await recon.saveEnvelope(owner.id, {
    title: "Variable",
    amount: "50",
    currency: "EUR",
    startMonth: "2026-10",
    categoryId: category.id,
    endMonth: null,
  });
  const variable = (
    await recon.listOccurrences(owner.id, "2026-10", "EUR", page)
  ).data.find(
    (o) => o.sourceType === "ENVELOPE" && o.sourceId === envelope.id
  )!;
  const reassigned = await update({
    ...payload,
    amount: "30.00",
    reconciliation: {
      occurrenceId: variable.id,
      expectedOccurrenceId: food.id,
    },
  });
  assert.strictEqual(reassigned.status, 200);
  assert.strictEqual(
    (await recon.getLink(owner.id, id)).occurrenceId,
    variable.id
  );
  const rebalanced = await engine.summarize(owner.id, "2026-10", "EUR", today);
  assert.strictEqual(rebalanced.budget.realRemainingMinorUnits, 165000); // fixed 300 + variable actual 30
  assert.strictEqual(rebalanced.forecast!.forecastRemainingMinorUnits, 165000); // variable remaining 20 only
  const mismatched = await update({
    ...payload,
    amount: "40.00",
    reconciliation: { occurrenceId: food.id, expectedOccurrenceId: null },
  });
  assert.strictEqual(mismatched.status, 409);
  assert.strictEqual(
    (await operations.findById(id, owner.id))!.money.minorUnits,
    3000
  );
  const { reconciliation: omitted, ...plainPayload } = payload;
  void omitted;
  assert.strictEqual(
    (await update({ ...plainPayload, title: "Lien conservé", amount: "30.00" }))
      .status,
    200
  );
  assert.strictEqual(
    (await recon.getLink(owner.id, id)).occurrenceId,
    variable.id
  );
  // Atomic unlink preserves the actual movement and restores the unmatched expense.
  assert.strictEqual(
    (
      await update({
        ...plainPayload,
        amount: "30.00",
        reconciliation: {
          occurrenceId: null,
          expectedOccurrenceId: variable.id,
        },
      })
    ).status,
    200
  );
  assert.strictEqual((await recon.getLink(owner.id, id)).occurrenceId, null);
  await operations.delete(id, owner.id);
  await operations.delete(second.body.data.id, owner.id);
  await recon.archiveEnvelope(owner.id, envelope.id);

  // Set up partial spending/income, then prove true close and next-month carry.
  const partial = await create({ ...payload, amount: "223.00" });
  assert.strictEqual(partial.status, 201);
  assert.strictEqual(
    (await engine.summarize(owner.id, "2026-10", "EUR", today)).budget
      .realRemainingMinorUnits,
    170000
  );
  today = "2026-11-01";
  // Forecast before the first closed summary must reconstruct the same carry without writes.
  const forecastBeforeClose = await forecast.forecast(
    owner.id,
    "2026-11",
    1,
    "EUR",
    today
  );
  const closed = await engine.summarize(owner.id, "2026-10", "EUR", today);
  assert.strictEqual(closed.period.status, "CLOSED");
  assert.strictEqual(closed.budget.realRemainingMinorUnits, 177700); // 2,000 fixed income - 223 spent
  assert.strictEqual(closed.period.reconciliationAdjustmentMinorUnits, 30000); // restore the 300 already reserved
  const november = await engine.summarize(owner.id, "2026-11", "EUR", today);
  assert.strictEqual(november.budget.carryInMinorUnits, 177700);
  assert.strictEqual(november.budget.realRemainingMinorUnits, 347700);
  assert.strictEqual(
    forecastBeforeClose.currentRealRemainingMinorUnits,
    347700
  );
  await db.operationFixe.updateMany({
    where: { userId: owner.id },
    data: { montant: "999.00" },
  });
  assert.strictEqual(
    (await engine.summarize(owner.id, "2026-10", "EUR", today)).budget
      .realRemainingMinorUnits,
    177700
  );
  // Retroactive unlinked corrections keep the frozen reconciliation adjustment.
  await useCases.create(owner.id, {
    title: "Correction réelle",
    amount: "1.00",
    currency: "EUR",
    kind: "DEPENSE",
    operationDate: "2026-10-31",
    categoryId: category.id,
  });
  await engine.recalculateFrom(owner.id, "2026-10", "EUR", today);
  assert.strictEqual(
    (await periods.find(owner.id, "2026-10", "EUR"))!.realRemainingMinorUnits,
    177600
  );
  assert.strictEqual(
    (await periods.find(owner.id, "2026-11", "EUR"))!.carryInMinorUnits,
    177600
  );
  assert.strictEqual(
    (await periods.find(owner.id, "2026-10", "EUR"))!
      .reconciliationAdjustmentMinorUnits,
    30000
  );
  // Real legacy fixed-operation routes, validators, JWT and persistence.
  const fixedApp = express();
  fixedApp.use(express.json());
  fixedApp.use("/operations-fixes", operationFixeRouter);
  fixedApp.use(errorHandler);
  const bearer = `Bearer ${new JsonWebTokenService().sign(
    { id: owner.id },
    process.env.ACCESS_TOKEN!
  )}`;
  const createFixed = await supertest(fixedApp)
    .post("/operations-fixes/charges")
    .set("Authorization", bearer)
    .send({ titre: "Ordinaire", montant: 10, devise: "EUR" });
  assert.strictEqual(createFixed.status, 201, JSON.stringify(createFixed.body));
  assert.strictEqual(createFixed.body.data.isBudgetEnvelope, false);
  assert.strictEqual(
    (
      await supertest(fixedApp)
        .post("/operations-fixes/charges")
        .set("Authorization", bearer)
        .send({
          titre: "Annuel invalide",
          montant: 120,
          devise: "EUR",
          periodicite: "ANNUELLE",
          isBudgetEnvelope: true,
        })
    ).status,
    422
  );
  const beforeCurrentAmount = (
    await db.operationFixe.findUniqueOrThrow({
      where: { idOperationFixe: food.sourceId },
    })
  ).montant.toString();
  const scheduledHttp = await supertest(fixedApp)
    .put(`/operations-fixes/charges/${food.sourceId}`)
    .set("Authorization", bearer)
    .send({
      titre: "Alimentation",
      montant: 350,
      devise: "EUR",
      isBudgetEnvelope: true,
      effectiveMonth: "2026-11",
    });
  assert.strictEqual(
    scheduledHttp.status,
    200,
    JSON.stringify(scheduledHttp.body)
  );
  const currentDefinition = await supertest(fixedApp)
    .get(`/operations-fixes/charges/${food.sourceId}`)
    .set("Authorization", bearer);
  assert.strictEqual(
    Number(currentDefinition.body.data[0].montant),
    Number(beforeCurrentAmount)
  );
  assert.strictEqual(currentDefinition.body.data[0].isBudgetEnvelope, true);
  const futureDefinition = await supertest(app).get(
    "/operations-fixes/months/2026-11"
  );
  assert.strictEqual(
    futureDefinition.status,
    200,
    JSON.stringify(futureDefinition.body)
  );
  assert.strictEqual(
    Number(
      futureDefinition.body.data.find((r: any) => r.id === food.sourceId)
        .montant
    ),
    350
  );
  assert.strictEqual(
    (await engine.summarize(owner.id, "2026-10", "EUR", today)).budget
      .realRemainingMinorUnits,
    177600
  );
  console.log(
    "Integrated MySQL + real HTTP: 300/400 balance, forecasts/savings, atomic create/update rollback, reassign/unlink, partial close and carry correction passed"
  );
}
run()
  .finally(async () => {
    await clean();
    await db.$disconnect();
    await apiDatabase.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
