/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import {
  SavingsTrajectoryService,
  SavingsTrajectorySnapshot,
} from "../../../src/modules/financialGoals/application/SavingsTrajectoryService";
import {
  createSavingsTrajectoryRouter,
  swSavingsTrajectoryRouter,
} from "../../../src/routes/savingsTrajectories";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { ForecastReads } from "../budgetPeriods/MultiMonthForecast.test";
const express = require("express") as typeof import("express");

const run = async () => {
  const reads = new ForecastReads();
  reads.fixed = { incomeMinorUnits: 320000, expenseMinorUnits: 160000 };
  reads.savings = 50000;
  reads.actual["2026-10"] = [
    { operationDate: "2026-10-01", kind: "DEPENSE", minorUnits: 32000 },
  ];
  reads.planned["2026-10"] = [
    {
      occurrenceDate: "2026-10-31",
      kind: "DEPENSE",
      minorUnits: 8000,
      count: 1,
    },
  ];
  reads.potential["2026-11"] = [
    {
      occurrenceDate: "2026-11-01",
      kind: "DEPENSE",
      minorUnits: 20000,
      count: 1,
    },
  ];
  const goals = [
    FinancialGoal.create({
      id: 1,
      ownerId: 7,
      title: "Voyage familial",
      currency: "EUR",
      targetAmount: "6000",
      savedAmount: "1800",
      monthlyContribution: "350",
      targetDate: "2027-05-31",
    }),
    FinancialGoal.create({
      id: 2,
      ownerId: 7,
      title: "Autre projet",
      currency: "EUR",
      targetAmount: "90000",
      savedAmount: "0",
      monthlyContribution: "150",
    }),
  ];
  const calls: unknown[] = [];
  const snapshots: SavingsTrajectorySnapshot = {
    read: async (owner, request, today) => {
      calls.push({ owner, request, today });
      const forecast = await new BudgetForecastService(reads).forecast(
        owner,
        today.slice(0, 7),
        request.months,
        request.currency,
        today,
        request.scenario
      );
      // Deliberately adversarial reader: service must still enforce owner/currency isolation.
      return { goals, months: forecast.months };
    },
  };
  const authenticate = (req: Request, _: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer owner") req.user = { id: 7 };
    else if (req.headers.authorization === "Bearer other") req.user = { id: 8 };
    else return next(new ErrorException(ErrorCode.Unauthorized));
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    createSavingsTrajectoryRouter(
      new SavingsTrajectoryService(snapshots),
      authenticate,
      () => "2026-10-25"
    )
  );
  app.use(errorHandler);
  const body = {
    currency: "eur",
    months: 24,
    selectedGoalId: 1,
    currentRemainingVariableExpense: "100.00",
    futureAdditionalVariableExpense: "700.00",
    monthlySafetyMargin: "100.00",
  };
  const request = (data: unknown, token = "owner", suffix = "") =>
    supertest(app)
      .post(`/savings-capacity/trajectories${suffix}`)
      .set("Authorization", `Bearer ${token}`)
      .send(data === null ? {} : (data as object));
  await request(body, "missing").expect(401);
  for (const invalid of [
    null,
    [],
    {},
    { ...body, ownerId: 8 },
    { ...body, months: 25 },
    { ...body, months: 0 },
    { ...body, months: "12" },
    { ...body, selectedGoalId: 1.5 },
    { ...body, selectedGoalId: 0 },
    { ...body, scenario: "maximum" },
    { ...body, currency: "EU" },
    { ...body, currentRemainingVariableExpense: "-1.00" },
    { ...body, monthlySafetyMargin: "1.001" },
    { ...body, monthlySafetyMargin: 100 },
    { ...body, futureAdditionalVariableExpense: "100000000.00" },
    { ...body, futureAdditionalVariableExpense: null },
  ])
    await request(invalid).expect(422);
  await request(body, "owner", "?ownerId=8").expect(422);
  assert.strictEqual(calls.length, 0);
  const result = (await request(body).expect(200)).body.data;
  // Assert the advertised response shape, including every money string and nullable date.
  const matches = (value: any, schema: any): void => {
    if (value === null && schema.nullable) return;
    if (schema.type === "object") {
      assert.deepStrictEqual(
        Object.keys(value).sort(),
        schema.required.slice().sort()
      );
      for (const [key, child] of Object.entries(schema.properties))
        matches(value[key], child);
    } else if (schema.type === "array") {
      assert.ok(Array.isArray(value));
      if (schema.maxItems !== undefined)
        assert.ok(value.length <= schema.maxItems);
      value.forEach((item: unknown) => matches(item, schema.items));
    } else {
      assert.strictEqual(
        typeof value,
        schema.type === "integer" ? "number" : schema.type
      );
      if (schema.type === "integer") assert.ok(Number.isInteger(value));
      if (schema.pattern) assert.match(value, new RegExp(schema.pattern));
      if (schema.enum) assert.ok(schema.enum.includes(value));
    }
  };
  matches(
    { data: result },
    swSavingsTrajectoryRouter["/savings-capacity/trajectories"].post.responses[
      "200"
    ].content["application/json"].schema
  );
  assert.strictEqual(result.currency, "EUR");
  assert.strictEqual(result.referenceDate, "2026-10-25");
  assert.strictEqual(
    result.projections.reasonable.current.remainingUnderAssumptions,
    "500.00"
  );
  assert.strictEqual(
    result.projections.reasonable.estimatedReachMonth,
    "2027-05"
  );
  assert.strictEqual(result.projections.maximum.estimatedReachMonth, "2027-01");
  assert.strictEqual(
    result.goals[0].forecast.requiredMonthlyContribution,
    "600.00"
  );
  assert.strictEqual(
    result.projections.planned.points[0].savedAmount,
    "1800.00"
  );
  const simulation = (
    await request({ ...body, scenario: "simulation" }).expect(200)
  ).body.data;
  assert.strictEqual(
    simulation.projections.reasonable.months[0].selectedTotalContribution,
    "450.00"
  );
  assert.deepStrictEqual((await request(body).expect(200)).body.data, result);
  await request(body, "other").expect(404);
  await request({ ...body, currency: "USD" }).expect(404);
  await request({ ...body, selectedGoalId: 999 }).expect(404);
  assert.ok(!JSON.stringify(result).includes("ownerId"));
  assert.ok(
    swSavingsTrajectoryRouter["/savings-capacity/trajectories"].post.responses[
      "200"
    ].content["application/json"].schema
  );
  assert.strictEqual(reads.actual["2026-10"][0].minorUnits, 32000);
  assert.strictEqual(goals[0].savedMinorUnits, 180000);
  console.log(
    "Savings trajectory API: authentication, validation, ownership, scenarios, decimal contracts and no mutation passed"
  );
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
