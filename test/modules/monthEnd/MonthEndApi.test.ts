/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import express, { Request, Response, NextFunction } from "express";
import supertest from "supertest";
import { PrismaClient } from "@prisma/client";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { createMonthEndRouter } from "../../../src/routes/monthEnd";
import { createBudgetPeriodRouter } from "../../../src/routes/budgetPeriods";
import { createBudgetForecastRouter } from "../../../src/routes/budgetForecast";
import { BudgetPeriodController } from "../../../src/modules/budgetPeriods/presentation/BudgetPeriodController";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application/BudgetPeriodEngine";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure/PrismaBudgetPeriodRepository";
import { PrismaMonthEndRepository } from "../../../src/modules/monthEnd/infrastructure/PrismaMonthEndRepository";
import { PrismaSavingsRepository } from "../../../src/modules/savings/infrastructure/PrismaSavingsRepository";
import { PrismaCurrentAccount } from "../../../src/modules/savings/infrastructure/PrismaCurrentAccount";
import { PrismaOneOffOperationRepository } from "../../../src/modules/operations/infrastructure/PrismaOneOffOperationRepository";
import { OneOffOperationUseCases } from "../../../src/modules/operations/application/OneOffOperationUseCases";
import { PrismaOperationCategoryRepository } from "../../../src/modules/operations/infrastructure/PrismaOperationCategoryRepository";
import { BudgetCorrectionService } from "../../../src/modules/budgetPeriods/application/BudgetCorrectionService";
import { PrismaOperationAnalyticsRepository } from "../../../src/modules/analytics/infrastructure/PrismaOperationAnalyticsRepository";
import { OperationAnalyticsUseCases } from "../../../src/modules/analytics/application/OperationAnalyticsUseCases";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw Error("Disposable test database required");
const prisma = new PrismaClient();
const emails = ["month-end-owner@test.local", "month-end-other@test.local"];
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const empty = { savings: [], coverage: [], exceptionalIncomeMinorUnits: 0 };
async function run() {
  await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          email,
          firstname: "Month",
          lastname: "End",
          password: "test-only",
          verified: true,
        },
      })
    )
  );
  let today = "2026-11-01";
  const clock = () => today;
  const savings = new PrismaSavingsRepository(prisma, clock);
  const periods = new PrismaBudgetPeriodRepository(prisma, undefined, clock);
  const engine = new BudgetPeriodEngine(periods);
  const decisions = new PrismaMonthEndRepository(prisma, clock);
  const operations = new OneOffOperationUseCases(
    new PrismaOneOffOperationRepository(prisma, undefined, clock),
    new PrismaOperationCategoryRepository(prisma),
    new BudgetCorrectionService(engine, clock)
  );
  try {
    const category = await prisma.operationCategory.create({
      data: { userId: owner.id, name: "Ordinaire" },
    });
    const operation = (
      amount: string,
      kind: "ENTREE" | "DEPENSE",
      day = "2026-10-15"
    ) =>
      operations.create(owner.id, {
        title: "Test",
        amount,
        kind,
        currency: "EUR",
        operationDate: day,
        categoryId: category.id,
      });
    const first = await savings.create(owner.id, {
      name: "Vacances",
      currency: "EUR",
      initialBalanceMinorUnits: 0,
    });
    const second = await savings.create(owner.id, {
      name: "Secours",
      currency: "EUR",
      initialBalanceMinorUnits: 0,
    });
    const foreign = await savings.create(other.id, {
      name: "Privé",
      currency: "EUR",
      initialBalanceMinorUnits: 10000,
    });
    const dollars = await savings.create(owner.id, {
      name: "Dollars",
      currency: "USD",
      initialBalanceMinorUnits: 10000,
    });
    await operation("150.00", "ENTREE");
    const app = express();
    app.use(express.json());
    const authenticate = (req: Request, _: Response, next: NextFunction) => {
      if (req.headers.authorization === "Bearer owner")
        req.user = { id: owner.id };
      else if (req.headers.authorization === "Bearer other")
        req.user = { id: other.id };
      else if (req.headers.authorization === "Bearer deleted")
        req.user = { id: 2147483647 };
      else return next(new ErrorException(ErrorCode.Unauthorized));
      next();
    };
    app.use(createMonthEndRouter(decisions, authenticate));
    app.use(
      createBudgetPeriodRouter(
        new BudgetPeriodController(engine, periods, clock),
        authenticate
      )
    );
    app.use(
      createBudgetForecastRouter(
        new BudgetForecastService(periods),
        authenticate,
        clock
      )
    );
    app.use(errorHandler);
    const get = (path = "/budget-periods/2026-10/decision") =>
      supertest(app).get(path).set("Authorization", "Bearer owner");
    for (const path of [
      "/budget-periods/2026-10/summary?currency=EUR",
      "/budget-forecast?from=2026-11&months=2&currency=EUR",
    ])
      assert.equal(
        (await supertest(app).get(path).set("Authorization", "Bearer deleted"))
          .status,
        404
      );
    const put = (body: unknown, month = "2026-10") =>
      supertest(app)
        .put(`/budget-periods/${month}/decision`)
        .set("Authorization", "Bearer owner")
        .send(body as object);
    const body = {
      ...empty,
      expectedRevision: 0,
      idempotencyKey: "decision-first-001",
      savings: [
        { accountId: second.id, amountMinorUnits: 3000 },
        { accountId: first.id, amountMinorUnits: 7000 },
      ],
    };
    assert.equal(
      (await supertest(app).get("/budget-periods/2026-10/decision")).status,
      401
    );
    assert.equal(
      (await supertest(app).put("/budget-periods/2026-10/decision").send(body))
        .status,
      401
    );
    // Before a decision, all 150€ carries; first day of next month is eligible.
    assert.equal(
      (await engine.summarize(owner.id, "2026-11", "EUR", today)).budget
        .carryInMinorUnits,
      15000
    );
    const pending = await get();
    assert.equal(pending.body.data.status, "PENDING");
    assert.equal(pending.body.data.carryMinorUnits, 15000);
    const current = await put(body, "2026-11");
    assert.equal(current.status, 409);
    assert.equal(current.body.error.details.code, "PERIOD_NOT_CLOSED");
    for (const invalid of [
      { ...body, userId: other.id },
      { ...body, exceptionalIncomeMinorUnits: "0" },
      { ...body, savings: [{ accountId: first.id, amountMinorUnits: 1.1 }] },
      { ...body, expectedRevision: "0" },
    ])
      assert.equal((await put(invalid)).status, 422);
    assert.equal((await get("/budget-periods/2026-13/decision")).status, 422);
    assert.equal(
      (await get("/budget-periods/2026-10/decision?currency[bad]=EUR")).status,
      422
    );
    const snapshot = async () => ({
      accounts: await prisma.savingsAccount.findMany({
        where: { userId: owner.id },
        orderBy: { id: "asc" },
      }),
      decisions: await prisma.monthEndDecision.count({
        where: { userId: owner.id },
      }),
      movements: await prisma.savingsMovement.count({
        where: { userId: owner.id },
      }),
    });
    const before = await snapshot();
    assert.equal(
      (
        await put({
          ...body,
          savings: [{ accountId: foreign.id, amountMinorUnits: 100 }],
        })
      ).status,
      404
    );
    assert.equal(
      (
        await put({
          ...body,
          savings: [{ accountId: dollars.id, amountMinorUnits: 100 }],
        })
      ).status,
      409
    );
    assert.deepStrictEqual(await snapshot(), before);
    // Force a failure after ledger/balances/recalculation, proving the enclosing transaction rolls back.
    const failingClient = new Proxy(prisma, {
      get(target, property) {
        if (property !== "$transaction") return Reflect.get(target, property);
        return (action: (tx: unknown) => Promise<unknown>, options: object) =>
          target.$transaction(
            (tx) =>
              action(
                new Proxy(tx, {
                  get(transaction, key) {
                    if (key !== "monthEndDecisionReceipt")
                      return Reflect.get(transaction, key);
                    return {
                      ...transaction.monthEndDecisionReceipt,
                      create: async () => {
                        throw new Error("Injected receipt failure");
                      },
                    };
                  },
                })
              ),
            options
          );
      },
    });
    await assert.rejects(
      () =>
        new PrismaMonthEndRepository(failingClient, clock).put(
          owner.id,
          "2026-10",
          "EUR",
          body
        ),
      /Injected receipt failure/
    );
    assert.deepStrictEqual(await snapshot(), before);
    assert.equal(
      (await engine.summarize(owner.id, "2026-11", "EUR", today)).budget
        .carryInMinorUnits,
      15000
    );
    const concurrent = await Promise.all([put(body), put(body)]);
    concurrent.forEach((result) =>
      assert.equal(result.status, 200, JSON.stringify(result.body))
    );
    assert.deepStrictEqual(concurrent[0].body, concurrent[1].body);
    const accepted = concurrent[0].body.data;
    assert.equal(accepted.carryMinorUnits, 5000);
    assert.equal(accepted.savingsMinorUnits, 10000);
    assert.equal(accepted.revision, 1);
    assert.equal(accepted.userId, undefined);
    assert.equal(accepted.id, undefined);
    assert.equal(
      await prisma.savingsMovement.count({ where: { userId: owner.id } }),
      2
    );
    assert.equal(
      (await savings.get(owner.id, first.id)).balanceMinorUnits,
      7000
    );
    assert.equal(
      (await engine.summarize(owner.id, "2026-11", "EUR", today)).budget
        .carryInMinorUnits,
      5000
    );
    const summary = await get("/budget-periods/2026-10/summary?currency=EUR");
    assert.equal(summary.body.data.monthEndDecision.savingsMinorUnits, 10000);
    assert.equal(summary.body.data.realRemaining, "50.00");
    const projected = await get(
      "/budget-forecast?from=2026-11&months=2&currency=EUR"
    );
    assert.equal(projected.status, 200, JSON.stringify(projected.body));
    assert.equal(projected.body.data.carryDecision.carryMinorUnits, 5000);
    assert.equal((await put({ ...body, savings: [] })).status, 409);
    assert.equal(
      (await put({ ...body, idempotencyKey: "stale-revision-001" })).body.error
        .details.code,
      "REVISION_CONFLICT"
    );
    // Use the real operation use case and its budget correction listener.
    await operation("30.00", "DEPENSE");
    const corrected = (await get()).body.data;
    assert.equal(corrected.savingsMinorUnits, 10000);
    assert.equal(corrected.carryMinorUnits, 2000);
    assert.equal(corrected.correctionDeltaMinorUnits, -3000);
    assert.equal(corrected.requiresReview, true);
    assert.equal(
      (await engine.summarize(owner.id, "2026-11", "EUR", today)).budget
        .carryInMinorUnits,
      2000
    );
    assert.equal(
      (await savings.get(owner.id, first.id)).balanceMinorUnits,
      7000
    );
    const revisedBody = {
      ...empty,
      expectedRevision: 1,
      idempotencyKey: "decision-revise-001",
      savings: [{ accountId: first.id, amountMinorUnits: 6000 }],
    };
    const revised = await put(revisedBody);
    assert.equal(revised.status, 200, JSON.stringify(revised.body));
    assert.equal(revised.body.data.carryMinorUnits, 6000);
    assert.equal(revised.body.data.requiresReview, false);
    const ledger = await savings.history(owner.id, first.id, {
      limit: 10,
      cursor: null,
    });
    assert(
      ledger.data.some(
        (row) =>
          row.isCompensation &&
          row.direction === "FROM_SAVINGS" &&
          row.amountMinorUnits === 1000
      )
    );
    assert.deepStrictEqual((await put(body)).body.data, accepted); // durable original receipt after correction/revision
    assert.equal(
      await prisma.savingsMovement.count({ where: { userId: owner.id } }),
      4
    );
    // Two distinct revision requests cannot both win.
    const race = await Promise.all(
      ["revision-race-001", "revision-race-002"].map((idempotencyKey) =>
        put({ ...revisedBody, expectedRevision: 2, idempotencyKey })
      )
    );
    assert.deepStrictEqual(race.map((row) => row.status).sort(), [200, 409]);
    assert.equal(
      await prisma.savingsMovement.count({ where: { userId: owner.id } }),
      4
    );
    // 60€ carry - 210€ expense = -150€; cover 50€ savings + 70€ exceptional -> -30€ carry.
    today = "2026-12-01";
    await operation("210.00", "DEPENSE", "2026-11-20");
    const negative = {
      ...empty,
      expectedRevision: 0,
      idempotencyKey: "negative-decision-001",
      coverage: [{ accountId: first.id, amountMinorUnits: 5000 }],
      exceptionalIncomeMinorUnits: 7000,
    };
    const covered = await put(negative, "2026-11");
    assert.equal(covered.status, 200, JSON.stringify(covered.body));
    assert.equal(covered.body.data.resultBeforeDecisionMinorUnits, -15000);
    assert.equal(covered.body.data.carryMinorUnits, -3000);
    assert.equal(
      (await engine.summarize(owner.id, "2026-12", "EUR", today)).budget
        .carryInMinorUnits,
      -3000
    );
    assert.equal(
      (await savings.get(owner.id, first.id)).balanceMinorUnits,
      1000
    );
    const analytics = new OperationAnalyticsUseCases(
      new PrismaOperationAnalyticsRepository(prisma)
    );
    const query = {
      from: "2026-11-01",
      to: "2026-11-30",
      currency: "EUR",
      groupBy: "category" as const,
      splitBy: null,
      kind: null,
    };
    const analysed = await analytics.aggregate(owner.id, query);
    assert.deepStrictEqual(
      analysed.buckets.find((row) => row.key === "0"),
      {
        key: "0",
        label: "Entrée exceptionnelle",
        color: null,
        income: "70.00",
        expense: "0.00",
        net: "70.00",
        count: 1,
      }
    );
    assert.equal(
      (await analytics.aggregate(other.id, query)).buckets.length,
      0
    );
    for (const groupBy of ["day", "week", "month", "year", "kind"] as const) {
      const all = await analytics.aggregate(owner.id, {
        ...query,
        groupBy,
        splitBy: "category",
      });
      assert.equal(
        all.buckets.reduce((sum, bucket) => sum + Number(bucket.income), 0),
        70
      );
      assert(
        all.buckets.some((bucket) =>
          bucket.series?.some(
            (series) =>
              series.key === "0" && series.label === "Entrée exceptionnelle"
          )
        )
      );
    }
    assert.equal(
      (
        await analytics.aggregate(owner.id, { ...query, kind: "DEPENSE" })
      ).buckets.some((row) => row.key === "0"),
      false
    );
    const movements = new PrismaCurrentAccount(prisma);
    let cursor: string | null = null;
    const sources: string[] = [];
    do {
      const page = await movements.history(owner.id, "2026-11", "EUR", {
        limit: 1,
        cursor,
      });
      sources.push(...page.data.map((row) => row.source));
      cursor = page.meta.nextCursor;
    } while (cursor);
    assert.deepStrictEqual(sources, [
      "VIREMENT",
      "EXCEPTIONAL_INCOME",
      "OPERATION",
    ]);
    const stable = await snapshot();
    const insufficient = await put(
      {
        ...negative,
        expectedRevision: 1,
        idempotencyKey: "insufficient-decision",
        coverage: [{ accountId: first.id, amountMinorUnits: 15000 }],
        exceptionalIncomeMinorUnits: 0,
      },
      "2026-11"
    );
    assert.equal(insufficient.status, 409);
    assert.equal(insufficient.body.error.details.code, "INSUFFICIENT_SAVINGS");
    assert.deepStrictEqual(await snapshot(), stable);
    // Case-sensitive idempotency and different owners remain independent.
    assert.equal(
      (
        await supertest(app)
          .get("/budget-periods/2026-10/decision")
          .set("Authorization", "Bearer other")
      ).body.data.status,
      "PENDING"
    );
    assert.equal(
      (
        await put(
          {
            ...negative,
            expectedRevision: 1,
            idempotencyKey: "Negative-decision-001",
          },
          "2026-11"
        )
      ).status,
      200
    );
    assert.equal(
      (
        await prisma.monthEndDecision.findFirstOrThrow({
          where: { userId: owner.id, month: date("2026-11-01") },
        })
      ).revision,
      2
    );
    // Reducing exceptional income replaces its active analytical amount, without duplicating the category.
    const reduced = await put(
      {
        ...negative,
        expectedRevision: 2,
        idempotencyKey: "exceptional-revised-001",
        exceptionalIncomeMinorUnits: 6000,
      },
      "2026-11"
    );
    assert.equal(reduced.status, 200, JSON.stringify(reduced.body));
    assert.equal(reduced.body.data.carryMinorUnits, -4000);
    assert.equal(
      (await analytics.aggregate(owner.id, query)).buckets.find(
        (row) => row.key === "0"
      )?.income,
      "60.00"
    );
    // An archived account may keep/reduce its existing allocation, but cannot increase it.
    await savings.update(owner.id, first.id, { archived: true });
    const increaseArchived = await put({
      ...revisedBody,
      expectedRevision: 3,
      idempotencyKey: "archived-increase-001",
      savings: [{ accountId: first.id, amountMinorUnits: 6100 }],
    });
    assert.equal(increaseArchived.status, 409);
    assert.equal(increaseArchived.body.error.details.code, "ACCOUNT_ARCHIVED");
    const acknowledgeArchived = await put({
      ...revisedBody,
      expectedRevision: 3,
      idempotencyKey: "archived-unchanged-001",
    });
    assert.equal(acknowledgeArchived.status, 200);
    const reduceArchived = await put({
      ...revisedBody,
      expectedRevision: 4,
      idempotencyKey: "archived-reduced-001",
      savings: [{ accountId: first.id, amountMinorUnits: 5900 }],
    });
    assert.equal(reduceArchived.status, 200);
    const downstream = (await get("/budget-periods/2026-11/decision")).body
      .data;
    assert.equal(downstream.coverageMinorUnits, 5000);
    assert.equal(downstream.exceptionalIncomeMinorUnits, 6000);
    assert.equal(downstream.carryMinorUnits, -3900);
    assert.equal(downstream.requiresReview, true);
    assert.equal(downstream.correctionDeltaMinorUnits, 100);
    // An explicit full carry is activity even when the budget contains only fixed income.
    await prisma.operationFixe.create({
      data: {
        userId: other.id,
        titre: "Revenu",
        montant: "50.00",
        devise: "EUR",
        typeOperation: "REVENU",
      },
    });
    const fullCarry = await decisions.put(other.id, "2026-11", "EUR", {
      ...empty,
      expectedRevision: 0,
      idempotencyKey: "fixed-only-report-001",
    });
    assert.equal(fullCarry.carryMinorUnits, 5000);
    assert.equal(
      (await engine.summarize(other.id, "2026-12", "EUR", today)).budget
        .carryInMinorUnits,
      5000
    );
    // Covered-month dates follow the calendar, including leap February.
    await prisma.operationFixe.deleteMany({ where: { userId: other.id } });
    const futureClock = new PrismaMonthEndRepository(
      prisma,
      () => "2028-04-01"
    );
    for (const [month, lastDay] of [
      ["2027-02", "2027-02-28"],
      ["2028-02", "2028-02-29"],
      ["2028-03", "2028-03-31"],
    ]) {
      await futureClock.put(other.id, month, "USD", {
        ...empty,
        expectedRevision: 0,
        idempotencyKey: `calendar-${month}-001`,
      });
      const row = await prisma.monthEndDecision.findFirstOrThrow({
        where: {
          userId: other.id,
          month: date(`${month}-01`),
          currency: "USD",
        },
      });
      assert.equal(row.operationDate.toISOString().slice(0, 10), lastDay);
    }
    console.log(
      "Month-end API/MySQL: carry, splits, correction, compensation, retries, races, ownership, analytics and pagination passed"
    );
  } finally {
    await prisma.operationFixe.deleteMany({
      where: { userId: { in: [owner.id, other.id] } },
    });
    await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
  }
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
