/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import { SavingsCapacityService } from "../../../src/modules/financialGoals/application/SavingsCapacityService";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { ForecastReads } from "../budgetPeriods/MultiMonthForecast.test";
import {
  createSavingsCapacityRouter,
  swSavingsCapacityRouter,
} from "../../../src/routes/savingsCapacity";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
const express = require("express") as typeof import("express");

const run = async () => {
  const repo = new ForecastReads();
  repo.fixed = { incomeMinorUnits: 200000, expenseMinorUnits: 80000 };
  repo.savings = 15000;
  const goal = FinancialGoal.create({
    id: 1,
    ownerId: 7,
    title: "Voyage",
    currency: "EUR",
    targetAmount: "1200.00",
    savedAmount: "300.00",
    monthlyContribution: "150.00",
    targetDate: "2027-03-15",
  });
  const goalCalls: Array<readonly [number, string]> = [];
  let selectedGoals = [goal];
  const service = new SavingsCapacityService(new BudgetForecastService(repo), {
    listForSavingsCapacity: async (ownerId, currency) => {
      goalCalls.push([ownerId, currency]);
      return ownerId === 7 && currency === "EUR" ? selectedGoals : [];
    },
  });
  const authenticate = (req: Request, _: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer owner") req.user = { id: 7 };
    else if (req.headers.authorization === "Bearer other") req.user = { id: 8 };
    else return next(new ErrorException(ErrorCode.Unauthorized));
    next();
  };
  const app = express();
  app.use(
    createSavingsCapacityRouter(service, authenticate, () => "2026-10-19")
  );
  app.use(errorHandler);
  const request = (query: string) =>
    supertest(app)
      .get(`/savings-capacity${query}`)
      .set("Authorization", "Bearer owner");
  await supertest(app)
    .get("/savings-capacity?from=2026-10&currency=EUR")
    .expect(401);
  for (const query of [
    "?from=2026-10",
    "?from=2026-10&currency=EU",
    "?from=2026-10&currency=EUR&ownerId=8",
    "?from=2026-09&currency=EUR",
    "?from=2026-10&currency=EUR&months=25",
    "?from=2026-10&currency=EUR&months=0",
    "?from=2026-10&currency=EUR&months=1&months=2",
    "?from=2026-10&currency[]=EUR",
  ])
    await request(query).expect(422);
  assert.strictEqual(goalCalls.length, 0);
  const response = await request("?from=2026-10&months=2&currency=eur").expect(
    200
  );
  assert.deepStrictEqual(response.body.data.goals, [
    {
      id: 1,
      title: "Voyage",
      targetDate: "2027-03-15",
      plannedMonthlyContribution: "150.00",
      requiredMonthlyContribution: "180.00",
      monthlyContributionGap: "30.00",
      includedInTotals: true,
      status: "BEHIND",
    },
  ]);
  assert.strictEqual(
    response.body.data.totalPlannedMonthlyContribution,
    "150.00"
  );
  assert.strictEqual(
    response.body.data.totalRequiredMonthlyContribution,
    "180.00"
  );
  assert.deepStrictEqual(response.body.data.months, [
    {
      month: "2026-10",
      beforeGoals: "1200.00",
      afterPlanned: "1050.00",
      afterRequired: "1020.00",
      sustainability: "TENABLE",
    },
    {
      month: "2026-11",
      beforeGoals: "2400.00",
      afterPlanned: "2100.00",
      afterRequired: "2040.00",
      sustainability: "TENABLE",
    },
  ]);
  const future = await request("?from=2026-12&months=1&currency=EUR").expect(
    200
  );
  assert.strictEqual(future.body.data.months[0].beforeGoals, "3600.00");
  assert.strictEqual(future.body.data.months[0].afterRequired, "3060.00");
  assert.strictEqual(
    (await request("?from=2026-10&currency=EUR")).body.data.months.length,
    12
  );
  const usd = await request("?from=2026-10&months=1&currency=USD").expect(200);
  assert.deepStrictEqual(usd.body.data.goals, []);
  await supertest(app)
    .get("/savings-capacity?from=2026-10&months=1&currency=EUR")
    .set("Authorization", "Bearer other")
    .expect(200);
  assert.deepStrictEqual(goalCalls[goalCalls.length - 1], [8, "EUR"]);
  assert.ok(!JSON.stringify(response.body.data).includes("ownerId"));
  selectedGoals = [
    FinancialGoal.create({
      id: 2,
      ownerId: 7,
      title: "Sans échéance",
      targetAmount: "1200.00",
      savedAmount: "300.00",
      monthlyContribution: "150.00",
      currency: "EUR",
    }),
  ];
  const unknown = await request("?from=2026-10&months=1&currency=EUR").expect(
    200
  );
  assert.strictEqual(unknown.body.data.totalRequiredMonthlyContribution, null);
  assert.strictEqual(unknown.body.data.unassessableCount, 1);
  assert.strictEqual(unknown.body.data.months[0].afterRequired, null);
  assert.strictEqual(unknown.body.data.months[0].sustainability, "INDETERMINE");
  assert.ok(
    swSavingsCapacityRouter["/savings-capacity"].get.responses["200"].content[
      "application/json"
    ].schema
  );
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
