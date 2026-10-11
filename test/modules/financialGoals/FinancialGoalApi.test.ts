/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import {
  FinancialGoalRepository,
  FinancialGoalUseCases,
} from "../../../src/modules/financialGoals/application";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import { FinancialGoalController } from "../../../src/modules/financialGoals/presentation";
import { CursorPage, PaginationRequest } from "../../../src/modules/pagination";
import { createFinancialGoalRouter } from "../../../src/routes/financialGoals";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const express = require("express") as typeof import("express");

class FakeRepository implements FinancialGoalRepository {
  public rows: FinancialGoal[] = [];
  private nextId = 1;

  public async listByOwner(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<FinancialGoal>> {
    return {
      data: this.rows
        .filter((row) => row.ownerId === ownerId)
        .slice(0, page.limit),
      meta: { limit: page.limit, hasNext: false, nextCursor: null },
    };
  }
  public async findById(
    id: number,
    ownerId: number
  ): Promise<FinancialGoal | null> {
    return (
      this.rows.find((row) => row.id === id && row.ownerId === ownerId) ?? null
    );
  }
  public async create(goal: FinancialGoal): Promise<FinancialGoal> {
    const row = FinancialGoal.create({
      id: this.nextId++,
      ownerId: goal.ownerId,
      title: goal.title,
      targetAmount: (goal.targetMinorUnits / 100).toFixed(2),
      savedAmount: (goal.savedMinorUnits / 100).toFixed(2),
      monthlyContribution: (goal.monthlyContributionMinorUnits / 100).toFixed(
        2
      ),
      currency: goal.currency,
      targetDate: goal.targetDate,
    });
    this.rows.push(row);
    return row;
  }
  public async update(goal: FinancialGoal): Promise<FinancialGoal | null> {
    if (goal.id == null || (await this.findById(goal.id, goal.ownerId)) == null)
      return null;
    this.rows = this.rows.map((row) => (row.id === goal.id ? goal : row));
    return goal;
  }
  public async delete(id: number, ownerId: number): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) => row.id !== id || row.ownerId !== ownerId
    );
    return before !== this.rows.length;
  }
}

const authenticate = (req: Request, _: Response, next: NextFunction) => {
  if (req.headers.authorization === "Bearer owner") req.user = { id: 7 };
  else if (req.headers.authorization === "Bearer other") req.user = { id: 8 };
  else return next(new ErrorException(ErrorCode.Unauthorized));
  next();
};

async function run() {
  const app = express();
  app.use(express.json());
  app.use(
    createFinancialGoalRouter(
      new FinancialGoalController(
        new FinancialGoalUseCases(new FakeRepository(), () => "2026-10-11")
      ),
      authenticate
    )
  );
  app.use(errorHandler);
  const owner = (request: supertest.Test) =>
    request.set("Authorization", "Bearer owner");

  assert.strictEqual((await supertest(app).get("/goals")).status, 401);
  assert.strictEqual(
    (await owner(supertest(app).get("/goals?limit=0"))).status,
    422
  );

  const invalid = await owner(supertest(app).post("/goals")).send({
    title: "Vacances",
    targetAmount: "1200.00",
    currency: "EUR",
    ownerId: 8,
  });
  assert.strictEqual(invalid.status, 422);
  const impossibleDate = await owner(supertest(app).post("/goals")).send({
    title: "Vacances",
    targetAmount: "1200.00",
    currency: "EUR",
    targetDate: "2027-02-30",
  });
  assert.strictEqual(impossibleDate.status, 422);
  assert.ok(
    JSON.stringify(impossibleDate.body).includes("INVALID_TARGET_DATE")
  );

  const created = await owner(supertest(app).post("/goals")).send({
    title: "Vacances",
    targetAmount: 1200,
    savedAmount: "300",
    monthlyContribution: "150.00",
    currency: "eur",
    targetDate: "2027-03-15",
  });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.headers.location, "/goals/1");
  assert.deepStrictEqual(created.body.data, {
    id: 1,
    title: "Vacances",
    targetAmount: "1200.00",
    savedAmount: "300.00",
    monthlyContribution: "150.00",
    currency: "EUR",
    targetDate: "2027-03-15",
    forecast: {
      referenceMonth: "2026-10",
      status: "BEHIND",
      remainingAmount: "900.00",
      contributionsNeeded: 6,
      estimatedReachMonth: "2027-04",
      requiredMonthlyContribution: "180.00",
    },
  });

  const defaults = await owner(supertest(app).post("/goals")).send({
    title: "Fonds d'urgence",
    targetAmount: "3000",
    currency: "EUR",
  });
  assert.strictEqual(defaults.status, 201);
  assert.strictEqual(defaults.body.data.savedAmount, "0.00");
  assert.strictEqual(defaults.body.data.forecast.status, "NO_DEADLINE");

  const other = (request: supertest.Test) =>
    request.set("Authorization", "Bearer other");
  assert.strictEqual((await other(supertest(app).get("/goals/1"))).status, 404);
  assert.deepStrictEqual(
    (await other(supertest(app).get("/goals"))).body.data,
    []
  );
  assert.strictEqual(
    (
      await other(supertest(app).put("/goals/1")).send({
        title: "Détourné",
        targetAmount: "1",
        currency: "EUR",
      })
    ).status,
    404
  );
  assert.strictEqual(
    (await owner(supertest(app).get("/goals/abc"))).status,
    400
  );

  const updated = await owner(supertest(app).put("/goals/1")).send({
    title: "Vacances",
    targetAmount: "1200.00",
    savedAmount: "1200.00",
    monthlyContribution: "150.00",
    currency: "EUR",
    targetDate: null,
  });
  assert.strictEqual(updated.status, 200);
  assert.strictEqual(updated.body.data.forecast.status, "REACHED");

  const list = await owner(supertest(app).get("/goals"));
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.data.length, 2);
  assert.deepStrictEqual(list.body.meta, {
    limit: 50,
    hasNext: false,
    nextCursor: null,
  });

  assert.strictEqual(
    (await other(supertest(app).delete("/goals/1"))).status,
    404
  );
  assert.strictEqual(
    (await owner(supertest(app).delete("/goals/1"))).status,
    204
  );
  assert.strictEqual((await owner(supertest(app).get("/goals/1"))).status, 404);
}

run().catch((error) => {
  throw error;
});
