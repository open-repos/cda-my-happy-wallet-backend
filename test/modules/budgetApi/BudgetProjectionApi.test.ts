/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { PrismaClient, TypeOperationFixeEnum } from "@prisma/client";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { BudgetPeriodController } from "../../../src/modules/budgetPeriods/presentation";
import { EventOccurrenceUseCases } from "../../../src/modules/eventOccurrences/application";
import { PrismaOccurrenceResolutionRepository } from "../../../src/modules/eventOccurrences/infrastructure";
import { EventOccurrenceController } from "../../../src/modules/eventOccurrences/presentation";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";
import {
  OneOffOperationUseCases,
  OperationCategoryUseCases,
} from "../../../src/modules/operations/application";
import {
  PrismaOneOffOperationRepository,
  PrismaOperationCategoryRepository,
} from "../../../src/modules/operations/infrastructure";
import { OneOffOperationController } from "../../../src/modules/operations/presentation";
import { createBudgetPeriodRouter } from "../../../src/routes/budgetPeriods";
import { createEventOccurrenceRouter } from "../../../src/routes/eventOccurrences";
import { createOneOffOperationRouter } from "../../../src/routes/oneOffOperations";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const express = require("express") as typeof import("express");

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error("Budget API tests require the disposable test database.");
}

const prisma = new PrismaClient();
const emails = [
  "budget-api-owner@example.test",
  "budget-api-other@example.test",
];
const TODAY = "2026-10-11";
const clock = () => TODAY;

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
  await prisma.operationFixe.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.utilisateur.deleteMany({ where: { id: { in: userIds } } });
};

const buildApp = (ids: { owner: number; other: number }) => {
  const authenticate = (req: Request, _: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer owner")
      req.user = { id: ids.owner };
    else if (req.headers.authorization === "Bearer other")
      req.user = { id: ids.other };
    else return next(new ErrorException(ErrorCode.Unauthorized));
    next();
  };
  const periods = new PrismaBudgetPeriodRepository(prisma);
  const categories = new PrismaOperationCategoryRepository(prisma);
  const app = express();
  app.use(express.json());
  app.use(
    createBudgetPeriodRouter(
      new BudgetPeriodController(
        new BudgetPeriodEngine(periods),
        periods,
        clock
      ),
      authenticate
    )
  );
  app.use(
    createEventOccurrenceRouter(
      new EventOccurrenceController(
        new EventOccurrenceUseCases(
          new PrismaMonthlyEventRepository(prisma),
          categories,
          periods,
          new PrismaOccurrenceResolutionRepository(prisma),
          clock
        )
      ),
      authenticate
    )
  );
  app.use(
    createOneOffOperationRouter(
      new OneOffOperationController(
        new OneOffOperationUseCases(
          new PrismaOneOffOperationRepository(prisma),
          categories
        ),
        new OperationCategoryUseCases(categories)
      ),
      authenticate
    )
  );
  app.use(errorHandler);
  return app;
};

const run = async () => {
  await cleanDatabase();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          firstname: "Budget",
          lastname: "Api",
          email,
          password: "not-a-real-password",
        },
      })
    )
  );
  const category = await prisma.operationCategory.create({
    data: { name: "Budget API", userId: owner.id },
  });
  await prisma.operationFixe.createMany({
    data: [
      {
        titre: "Salaire",
        montant: "2000.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.REVENU,
        userId: owner.id,
      },
      {
        titre: "Charges",
        montant: "800.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.CHARGE,
        userId: owner.id,
      },
    ],
  });
  const rent = await prisma.evenementMensuel.create({
    data: {
      title: "Loyer",
      amount: "300.00",
      currency: "EUR",
      startDate: new Date("2026-08-05T00:00:00.000Z"),
      recurrence: "MENSUELLE",
      userId: owner.id,
    },
  });
  await prisma.objectifFinancier.create({
    data: {
      title: "Vacances",
      targetAmount: "1200.00",
      savedAmount: "300.00",
      monthlyContribution: "150.00",
      currency: "EUR",
      userId: owner.id,
    },
  });

  const app = buildApp({ owner: owner.id, other: other.id });
  const asOwner = (test: supertest.Test) =>
    test.set("Authorization", "Bearer owner");
  const asOther = (test: supertest.Test) =>
    test.set("Authorization", "Bearer other");

  // Authentification et validation.
  assert.strictEqual(
    (await supertest(app).get("/budget-periods/2026-10/summary?currency=EUR"))
      .status,
    401
  );
  for (const url of [
    "/budget-periods/2026-13/summary?currency=EUR",
    "/budget-periods/2026-10/summary?currency=EU",
    "/budget-periods/2026-10/summary?currency=EUR&ownerId=1",
    "/budget-periods/history?currency=EUR&limit=0",
    "/event-occurrences/pending?through=2026-02-30",
    "/operations?from=2026-10-31&to=2026-10-01",
    "/operations?currency=EURO",
  ]) {
    assert.strictEqual(
      (await asOwner(supertest(app).get(url))).status,
      422,
      url
    );
  }
  const future = await asOwner(
    supertest(app).get("/budget-periods/2026-11/summary?currency=EUR")
  );
  assert.strictEqual(future.status, 422);
  assert.ok(JSON.stringify(future.body).includes("FUTURE_PERIOD"));

  // Synthèse du mois courant.
  const summary = await asOwner(
    supertest(app).get("/budget-periods/2026-10/summary?currency=eur")
  );
  assert.strictEqual(summary.status, 200);
  const data = summary.body.data;
  assert.strictEqual(data.currency, "EUR");
  assert.strictEqual(data.status, "OPEN");
  assert.strictEqual(data.realRemaining, "1200.00");
  assert.strictEqual(data.remainingDays, 21);
  assert.deepStrictEqual(data.forecast, {
    plannedIncome: "0.00",
    plannedExpense: "300.00",
    goalSavings: "150.00",
    forecastRemaining: "750.00",
    prudentDailyAllowance: "35.71",
    unresolvedCount: 1,
    overdueCount: 1,
  });
  assert.strictEqual(data.days.length, 31);
  assert.strictEqual(data.days[4].plannedExpense, "300.00");
  assert.strictEqual(data.days[30].forecastRemaining, "750.00");
  assert.ok(!JSON.stringify(data).includes("userId"));
  assert.ok(!JSON.stringify(data).includes("ownerId"));

  // File à traiter : août, septembre et octobre sont en retard.
  const pending = await asOwner(
    supertest(app).get("/event-occurrences/pending?limit=2")
  );
  assert.strictEqual(pending.status, 200);
  assert.deepStrictEqual(
    pending.body.data.map(
      (item: { occurrenceDate: string }) => item.occurrenceDate
    ),
    ["2026-08-05", "2026-09-05"]
  );
  assert.strictEqual(pending.body.data[0].overdue, true);
  assert.strictEqual(pending.body.meta.hasNext, true);
  const pendingNext = await asOwner(
    supertest(app).get(
      `/event-occurrences/pending?limit=2&cursor=${encodeURIComponent(
        pending.body.meta.nextCursor
      )}`
    )
  );
  assert.deepStrictEqual(
    pendingNext.body.data.map(
      (item: { occurrenceDate: string }) => item.occurrenceDate
    ),
    ["2026-10-05"]
  );
  assert.deepStrictEqual(
    (await asOther(supertest(app).get("/event-occurrences/pending"))).body.data,
    []
  );

  // Réalisation, rejeu, conflit et isolation.
  const realizeUrl = `/event-occurrences/${rent.id}/2026-10-05/realize`;
  const body = { categoryId: category.id, amount: "287.90" };
  assert.strictEqual(
    (await asOther(supertest(app).post(realizeUrl)).send(body)).status,
    404
  );
  assert.strictEqual(
    (
      await asOwner(supertest(app).post(realizeUrl)).send({
        ...body,
        ownerId: 1,
      })
    ).status,
    422
  );
  assert.strictEqual(
    (
      await asOwner(supertest(app).post(realizeUrl)).send({
        categoryId: 999999,
      })
    ).status,
    404
  );
  assert.strictEqual(
    (
      await asOwner(
        supertest(app).post(`/event-occurrences/${rent.id}/2026-10-06/realize`)
      ).send(body)
    ).status,
    404
  );
  const realized = await asOwner(supertest(app).post(realizeUrl)).send(body);
  assert.strictEqual(realized.status, 201);
  assert.strictEqual(realized.body.data.status, "REALIZED");
  assert.strictEqual(realized.body.data.amount, "300.00");
  assert.strictEqual(realized.body.data.operation.amount, "287.90");
  assert.strictEqual(
    (await asOwner(supertest(app).post(realizeUrl)).send(body)).status,
    200
  );
  const conflict = await asOwner(supertest(app).post(realizeUrl)).send({
    categoryId: category.id,
  });
  assert.strictEqual(conflict.status, 409);
  assert.ok(
    JSON.stringify(conflict.body).includes("OCCURRENCE_ALREADY_RESOLVED")
  );

  // Une occurrence en retard ne peut pas créer d'opération dans un mois passé.
  const closedPeriod = await asOwner(
    supertest(app).post(`/event-occurrences/${rent.id}/2026-09-05/realize`)
  ).send({ categoryId: category.id });
  assert.strictEqual(closedPeriod.status, 409);
  assert.ok(JSON.stringify(closedPeriod.body).includes("PERIOD_CLOSED"));
  const cancelUrl = `/event-occurrences/${rent.id}/2026-09-05/cancel`;
  assert.strictEqual(
    (await asOwner(supertest(app).post(cancelUrl))).status,
    201
  );
  assert.strictEqual(
    (await asOwner(supertest(app).post(cancelUrl))).status,
    200
  );
  assert.strictEqual(
    (
      await asOwner(
        supertest(app).post(`/event-occurrences/${rent.id}/2026-10-05/cancel`)
      )
    ).status,
    409
  );
  assert.strictEqual(
    (
      await asOwner(
        supertest(app).post(`/event-occurrences/abc/2026-10-05/cancel`)
      )
    ).status,
    400
  );

  const afterRealization = await asOwner(
    supertest(app).get("/budget-periods/2026-10/summary?currency=EUR")
  );
  assert.strictEqual(afterRealization.body.data.realRemaining, "912.10");
  assert.strictEqual(
    afterRealization.body.data.forecast.plannedExpense,
    "0.00"
  );
  assert.strictEqual(
    afterRealization.body.data.forecast.forecastRemaining,
    "762.10"
  );

  // Opérations filtrées par jour, devise et curseur.
  await prisma.oneOffOperationRecord.createMany({
    data: [
      {
        title: "Courses",
        amount: "20.00",
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date("2026-10-05T00:00:00.000Z"),
        userId: owner.id,
        categoryId: category.id,
      },
      {
        title: "Voyage",
        amount: "40.00",
        currency: "USD",
        type: "DEPENSE",
        operationDate: new Date("2026-10-05T00:00:00.000Z"),
        userId: owner.id,
        categoryId: category.id,
      },
      {
        title: "Hier",
        amount: "5.00",
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date("2026-10-04T00:00:00.000Z"),
        userId: owner.id,
        categoryId: category.id,
      },
    ],
  });
  const day = await asOwner(
    supertest(app).get(
      "/operations?from=2026-10-05&to=2026-10-05&currency=eur&limit=1"
    )
  );
  assert.strictEqual(day.status, 200);
  assert.strictEqual(day.body.data.length, 1);
  assert.strictEqual(day.body.meta.hasNext, true);
  const dayNext = await asOwner(
    supertest(app).get(
      `/operations?from=2026-10-05&to=2026-10-05&currency=EUR&limit=1&cursor=${encodeURIComponent(
        day.body.meta.nextCursor
      )}`
    )
  );
  assert.strictEqual(dayNext.body.data.length, 1);
  assert.strictEqual(dayNext.body.meta.hasNext, false);
  assert.deepStrictEqual(
    [...day.body.data, ...dayNext.body.data]
      .map((item: { title: string }) => item.title)
      .sort(),
    ["Courses", "Loyer"]
  );
  // Un curseur ne peut pas être réutilisé avec d'autres filtres.
  assert.strictEqual(
    (
      await asOwner(
        supertest(app).get(
          `/operations?from=2026-10-01&to=2026-10-31&limit=1&cursor=${encodeURIComponent(
            day.body.meta.nextCursor
          )}`
        )
      )
    ).status,
    422
  );
  const unfiltered = await asOwner(supertest(app).get("/operations"));
  assert.strictEqual(unfiltered.body.data.length, 4);
  assert.deepStrictEqual(
    (await asOther(supertest(app).get("/operations?from=2026-10-01"))).body
      .data,
    []
  );

  // Historique : la lecture de septembre le clôture.
  const september = await asOwner(
    supertest(app).get("/budget-periods/2026-09/summary?currency=EUR")
  );
  assert.strictEqual(september.body.data.status, "CLOSED");
  assert.strictEqual(september.body.data.forecast, null);
  assert.strictEqual(september.body.data.unresolvedEvents, 0);
  await asOwner(
    supertest(app).get("/budget-periods/2026-08/summary?currency=EUR")
  );
  const history = await asOwner(
    supertest(app).get("/budget-periods/history?currency=EUR&limit=1")
  );
  assert.strictEqual(history.status, 200);
  assert.strictEqual(history.body.data[0].month, "2026-09");
  assert.strictEqual(history.body.data[0].balanceStatus, "POSITIVE");
  const older = await asOwner(
    supertest(app).get(
      `/budget-periods/history?currency=EUR&limit=1&cursor=${encodeURIComponent(
        history.body.meta.nextCursor
      )}`
    )
  );
  assert.strictEqual(older.body.data[0].month, "2026-08");
  assert.strictEqual(older.body.data[0].unresolvedEvents, 1);
  assert.strictEqual(older.body.meta.hasNext, false);
  assert.deepStrictEqual(
    (await asOther(supertest(app).get("/budget-periods/history?currency=EUR")))
      .body.data,
    []
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
