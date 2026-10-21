/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import {
  createBudgetForecastRouter,
  swBudgetForecastRouter,
} from "../../../src/routes/budgetForecast";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { ForecastReads } from "../budgetPeriods/MultiMonthForecast.test";
const express = require("express") as typeof import("express");

const run = async () => {
  const repo = new ForecastReads();
  const authenticate = (req: Request, _: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer owner") req.user = { id: 7 };
    else if (req.headers.authorization === "Bearer other") req.user = { id: 8 };
    else return next(new ErrorException(ErrorCode.Unauthorized));
    next();
  };
  const app = express();
  app.use(
    createBudgetForecastRouter(
      new BudgetForecastService(repo),
      authenticate,
      () => "2026-10-31"
    )
  );
  app.use(errorHandler);
  const request = (query: string) =>
    supertest(app)
      .get(`/budget-forecast${query}`)
      .set("Authorization", "Bearer owner");
  await supertest(app)
    .get("/budget-forecast?from=2026-10&currency=EUR")
    .expect(401);
  for (const query of [
    "?from=2026-10",
    "?from=2026-13&currency=EUR",
    "?from=2026-09&currency=EUR",
    "?from=2026-10&currency=EU",
    "?from=2026-10&currency[]=EUR",
    "?from=2026-10&currency=EUR&ownerId=8",
    ...["0", "25", "-1", "1.5", "2e1", "", "1&months=2"].map(
      (n) => `?from=2026-10&currency=EUR&months=${n}`
    ),
  ])
    await request(query).expect(422);
  assert.strictEqual(repo.calls.length, 0);
  const response = await request("?from=2026-10&currency=eur&months=2").expect(
    200
  );
  assert.strictEqual(response.body.data.currency, "EUR");
  assert.strictEqual(response.body.data.currentRealRemaining, "80.00");
  assert.strictEqual(response.body.data.months.length, 2);
  assert.deepStrictEqual(response.body.data.months[0], {
    month: "2026-10",
    fixedIncome: "100.00",
    fixedExpense: "20.00",
    base: "80.00",
    carryIn: "80.00",
    plannedIncome: "0.00",
    plannedExpense: "0.00",
    goalSavings: "10.00",
    forecastResult: "-10.00",
    forecastRemaining: "70.00",
    remainingDays: 1,
    prudentDailyAllowance: "70.00",
    prudentWeeklyAllowance: "70.00",
    prudentMonthlyAllowance: "70.00",
  });
  assert.ok(
    repo.calls.every(([owner, currency]) => owner === 7 && currency === "EUR")
  );
  repo.calls = [];
  await supertest(app)
    .get("/budget-forecast?from=2026-11&currency=USD")
    .set("Authorization", "Bearer other")
    .expect(200);
  assert.ok(
    repo.calls.every(([owner, currency]) => owner === 8 && currency === "USD")
  );
  assert.strictEqual(
    (await request("?from=2026-10&currency=EUR")).body.data.months.length,
    12
  );
  assert.strictEqual(
    (await request("?from=2026-10&currency=EUR&months=24")).body.data.months
      .length,
    24
  );
  assert.ok(
    swBudgetForecastRouter["/budget-forecast"].get.responses["200"].content[
      "application/json"
    ].schema
  );
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
