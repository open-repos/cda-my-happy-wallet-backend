/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import {
  MonthlyEventRepository,
  MonthlyEventUseCases,
} from "../../../src/modules/monthlyEvents/application";
import {
  MonthlyEvent,
  MonthlyEventOccurrence,
  MonthlyEventStatus,
  BudgetScenario,
} from "../../../src/modules/monthlyEvents/domain";
import { MonthlyEventController } from "../../../src/modules/monthlyEvents/presentation";
import { CursorPage, PaginationRequest } from "../../../src/modules/pagination";
import { createMonthlyEventRouter } from "../../../src/routes/monthlyEvents";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const express = require("express") as typeof import("express");

export class FakeRepository implements MonthlyEventRepository {
  public rows: MonthlyEvent[] = [];
  private nextId = 1;

  public async listByOwner(
    ownerId: number,
    page: PaginationRequest,
    status: MonthlyEventStatus = "CONFIRME"
  ): Promise<CursorPage<MonthlyEvent>> {
    return this.page(
      this.rows.filter(
        (row) => row.ownerId === ownerId && row.status === status
      ),
      page
    );
  }
  public async listOccurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest,
    scenario: BudgetScenario = "standard"
  ): Promise<CursorPage<MonthlyEventOccurrence>> {
    const rows = this.rows
      .filter(
        (row) =>
          row.ownerId === ownerId &&
          (scenario === "simulation" || row.status === "CONFIRME")
      )
      .flatMap((event) =>
        event
          .occurrencesIn(month)
          .map((occurrenceDate) => ({ event, occurrenceDate }))
      );
    return this.page(rows, page);
  }
  public async findById(
    id: number,
    ownerId: number
  ): Promise<MonthlyEvent | null> {
    return (
      this.rows.find((row) => row.id === id && row.ownerId === ownerId) ?? null
    );
  }
  public async create(event: MonthlyEvent): Promise<MonthlyEvent> {
    const row = this.copy(event, this.nextId++);
    this.rows.push(row);
    return row;
  }
  public async update(event: MonthlyEvent): Promise<MonthlyEvent | null> {
    if (
      event.id == null ||
      (await this.findById(event.id, event.ownerId)) == null
    )
      return null;
    this.rows = this.rows.map((row) =>
      row.id === event.id && row.ownerId === event.ownerId ? event : row
    );
    return event;
  }
  public async delete(id: number, ownerId: number): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) => row.id !== id || row.ownerId !== ownerId
    );
    return before !== this.rows.length;
  }
  public async confirm(
    id: number,
    ownerId: number
  ): Promise<MonthlyEvent | null> {
    const event = await this.findById(id, ownerId);
    if (event === null) return null;
    const confirmed = this.copy(event, id, "CONFIRME");
    return this.update(confirmed);
  }
  public async clearPotential(ownerId: number): Promise<void> {
    this.rows = this.rows.filter(
      (row) => row.ownerId !== ownerId || row.status === "CONFIRME"
    );
  }
  private page<T>(rows: T[], page: PaginationRequest): CursorPage<T> {
    return {
      data: rows.slice(0, page.limit),
      meta: { limit: page.limit, hasNext: false, nextCursor: null },
    };
  }
  private copy(
    event: MonthlyEvent,
    id: number,
    status = event.status
  ): MonthlyEvent {
    return MonthlyEvent.create({
      id,
      ownerId: event.ownerId,
      title: event.title,
      amount: (event.minorUnits / 100).toFixed(2),
      currency: event.currency,
      kind: event.kind,
      status,
      startDate: event.startDate,
      recurrence: event.recurrence,
      endDate: event.endDate,
    });
  }
}

const authenticate = (req: Request, _: Response, next: NextFunction) => {
  if (req.headers.authorization === "Bearer owner") req.user = { id: 7 };
  else if (req.headers.authorization === "Bearer other") req.user = { id: 8 };
  else return next(new ErrorException(ErrorCode.Unauthorized));
  next();
};

async function run() {
  const repository = new FakeRepository();
  const app = express();
  app.use(express.json());
  app.use(
    createMonthlyEventRouter(
      new MonthlyEventController(new MonthlyEventUseCases(repository)),
      authenticate
    )
  );
  app.use(errorHandler);

  for (const [method, path] of [
    ["get", "/events"],
    ["post", "/events"],
    ["get", "/events/1"],
    ["put", "/events/1"],
    ["delete", "/events/1"],
    ["get", "/event-occurrences"],
  ] as const) {
    const response = await supertest(app)[method](path).send({});
    assert.strictEqual(response.status, 401, `${method} ${path}`);
    assert.match(response.headers["content-type"], /^application\/json\b/);
    assert.deepStrictEqual(response.body, {
      response: "error",
      error: {
        type: "Unauthorized",
        path,
        statusCode: 401,
        message: "User Unauthorized",
      },
    });
  }
  assert.strictEqual(
    (
      await supertest(app)
        .get("/event-occurrences?month=2026-13")
        .set("Authorization", "Bearer owner")
    ).status,
    422
  );
  assert.strictEqual(
    (
      await supertest(app)
        .get("/event-occurrences?month=2026-02&ownerId=8")
        .set("Authorization", "Bearer owner")
    ).status,
    422
  );

  const invalid = await supertest(app)
    .post("/events")
    .set("Authorization", "Bearer owner")
    .send({
      title: "Prime",
      amount: "10.00",
      currency: "EUR",
      kind: "ENTREE",
      startDate: "2026-02-31",
      recurrence: "AUCUNE",
      ownerId: 99,
    });
  assert.strictEqual(invalid.status, 422);

  const created = await supertest(app)
    .post("/events")
    .set("Authorization", "Bearer owner")
    .send({
      title: "Prime",
      amount: "10.00",
      currency: "eur",
      kind: "ENTREE",
      startDate: "2026-01-31",
      recurrence: "MENSUELLE",
      endDate: "2026-03-31",
    });
  assert.strictEqual(created.status, 201);
  assert.match(created.headers["content-type"], /^application\/json\b/);
  assert.strictEqual(created.headers.location, "/events/1");
  const expectedEvent = {
    id: 1,
    title: "Prime",
    amount: "10.00",
    currency: "EUR",
    kind: "ENTREE",
    status: "CONFIRME",
    startDate: "2026-01-31",
    recurrence: "MENSUELLE",
    endDate: "2026-03-31",
  };
  assert.deepStrictEqual(created.body, { data: expectedEvent });
  const read = await supertest(app)
    .get("/events/1")
    .set("Authorization", "Bearer owner");
  assert.strictEqual(read.status, 200);
  assert.deepStrictEqual(read.body, { data: expectedEvent });
  const listed = await supertest(app)
    .get("/events")
    .set("Authorization", "Bearer owner");
  assert.deepStrictEqual(listed.body, {
    data: [expectedEvent],
    meta: { limit: 50, hasNext: false, nextCursor: null },
  });

  const validInput = {
    title: "Prime modifiée",
    amount: "12.30",
    currency: "EUR",
    kind: "ENTREE",
    startDate: "2026-01-31",
    recurrence: "MENSUELLE",
    endDate: "2026-03-31",
  };
  for (const [overrides, code] of [
    [{ startDate: "2026-02-31" }, "INVALID_START_DATE"],
    [{ endDate: "2026-01-30" }, "INVALID_END_DATE"],
  ] as const) {
    const response = await supertest(app)
      .post("/events")
      .set("Authorization", "Bearer owner")
      .send({ ...validInput, ...overrides });
    assert.strictEqual(response.status, 422);
    assert.deepStrictEqual(response.body, {
      response: "error",
      error: {
        type: "ValidationFailed",
        path: "/events",
        statusCode: 422,
        message: "Monthly event data is invalid",
        details: { code },
      },
    });
  }
  for (const overrides of [{ ownerId: 99 }, { amount: "1.234" }]) {
    const response = await supertest(app)
      .put("/events/1")
      .set("Authorization", "Bearer owner")
      .send({ ...validInput, ...overrides });
    assert.strictEqual(response.status, 422);
    assert.strictEqual(response.body.error.type, "ValidationFailed");
    assert.strictEqual(response.body.error.path, "/events/1");
  }
  assert.strictEqual(repository.rows.length, 1);
  assert.strictEqual(repository.rows[0].minorUnits, 1000);

  const foreignUpdate = await supertest(app)
    .put("/events/1")
    .set("Authorization", "Bearer other")
    .send(validInput);
  assert.strictEqual(foreignUpdate.status, 404);
  assert.deepStrictEqual(foreignUpdate.body, {
    response: "error",
    error: {
      type: "NotFound",
      path: "/events/1",
      statusCode: 404,
      message: "The requested resource was not found",
    },
  });
  assert.strictEqual(repository.rows[0].title, "Prime");
  for (const method of ["get", "put", "delete"] as const) {
    const response = await supertest(app)
      [method]("/events/abc")
      .set("Authorization", "Bearer owner")
      .send(validInput);
    assert.strictEqual(response.status, 400, method);
    assert.strictEqual(response.body.error.type, "WrongParamsID");
  }

  assert.strictEqual(
    (await supertest(app).get("/events/1").set("Authorization", "Bearer other"))
      .status,
    404
  );
  const otherList = await supertest(app)
    .get("/events")
    .set("Authorization", "Bearer other");
  assert.deepStrictEqual(otherList.body.data, []);

  const occurrences = await supertest(app)
    .get("/event-occurrences?month=2026-02&limit=10")
    .set("Authorization", "Bearer owner");
  assert.strictEqual(occurrences.status, 200);
  assert.deepStrictEqual(occurrences.body, {
    data: [{ ...expectedEvent, occurrenceDate: "2026-02-28" }],
    meta: { limit: 10, hasNext: false, nextCursor: null },
  });
  const updated = await supertest(app)
    .put("/events/1")
    .set("Authorization", "Bearer owner")
    .send(validInput);
  assert.strictEqual(updated.status, 200);
  assert.deepStrictEqual(updated.body, {
    data: { ...expectedEvent, title: "Prime modifiée", amount: "12.30" },
  });

  assert.strictEqual(
    (
      await supertest(app)
        .delete("/events/1")
        .set("Authorization", "Bearer other")
    ).status,
    404
  );
  assert.strictEqual(
    (
      await supertest(app)
        .delete("/events/1")
        .set("Authorization", "Bearer owner")
    ).status,
    204
  );
  const missing = await supertest(app)
    .get("/events/1")
    .set("Authorization", "Bearer owner");
  assert.strictEqual(missing.status, 404);

  for (const recurrence of ["HEBDOMADAIRE", "TRIMESTRIELLE", "ANNUELLE"]) {
    const created = await supertest(app)
      .post("/events")
      .set("Authorization", "Bearer owner")
      .send({
        ...validInput,
        recurrence,
        startDate: "2024-02-29",
        endDate: "2028-02-29",
      });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.data.recurrence, recurrence);
    const id = created.body.data.id;
    await supertest(app)
      .get(`/events/${id}`)
      .set("Authorization", "Bearer other")
      .expect(404);
    await supertest(app)
      .put(`/events/${id}`)
      .set("Authorization", "Bearer owner")
      .send({
        ...validInput,
        recurrence,
        startDate: "2024-02-29",
        endDate: "2028-02-29",
      })
      .expect(200);
  }
  const recurringOccurrences = await supertest(app)
    .get("/event-occurrences?month=2024-03")
    .set("Authorization", "Bearer owner")
    .expect(200);
  assert.deepStrictEqual(
    recurringOccurrences.body.data.map(
      (row: { occurrenceDate: string }) => row.occurrenceDate
    ),
    ["2024-03-07", "2024-03-14", "2024-03-21", "2024-03-28"]
  );
  assert.deepStrictEqual(
    (
      await supertest(app)
        .get("/event-occurrences?month=2024-03")
        .set("Authorization", "Bearer other")
    ).body.data,
    []
  );
  await supertest(app)
    .post("/events")
    .set("Authorization", "Bearer owner")
    .send({ ...validInput, recurrence: "QUOTIDIENNE" })
    .expect(422);

  repository.listByOwner = async () => {
    throw new Error("private repository details");
  };
  const failed = await supertest(app)
    .get("/events")
    .set("Authorization", "Bearer owner");
  assert.strictEqual(failed.status, 500);
  assert.deepStrictEqual(failed.body, {
    response: "error",
    error: {
      type: "UnknownError",
      path: "/events",
      statusCode: 500,
      message: "Unknown Error",
    },
  });
}

if (require.main === module)
  run().catch((error) => {
    throw error;
  });
