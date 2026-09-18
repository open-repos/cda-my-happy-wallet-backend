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
} from "../../../src/modules/monthlyEvents/domain";
import { MonthlyEventController } from "../../../src/modules/monthlyEvents/presentation";
import { CursorPage, PaginationRequest } from "../../../src/modules/pagination";
import { createMonthlyEventRouter } from "../../../src/routes/monthlyEvents";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const express = require("express") as typeof import("express");

class FakeRepository implements MonthlyEventRepository {
  public rows: MonthlyEvent[] = [];
  private nextId = 1;

  public async listByOwner(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEvent>> {
    return this.page(
      this.rows.filter((row) => row.ownerId === ownerId),
      page
    );
  }
  public async listOccurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEventOccurrence>> {
    const rows = this.rows
      .filter((row) => row.ownerId === ownerId)
      .flatMap((event) => {
        const occurrenceDate = event.occurrenceIn(month);
        return occurrenceDate == null ? [] : [{ event, occurrenceDate }];
      });
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
  private page<T>(rows: T[], page: PaginationRequest): CursorPage<T> {
    return {
      data: rows.slice(0, page.limit),
      meta: { limit: page.limit, hasNext: false, nextCursor: null },
    };
  }
  private copy(event: MonthlyEvent, id: number): MonthlyEvent {
    return MonthlyEvent.create({
      id,
      ownerId: event.ownerId,
      title: event.title,
      amount: (event.minorUnits / 100).toFixed(2),
      currency: event.currency,
      kind: event.kind,
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

  assert.strictEqual((await supertest(app).get("/events")).status, 401);
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
  assert.strictEqual(created.body.data.amount, "10.00");
  assert.strictEqual(created.body.data.ownerId, undefined);

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
  assert.strictEqual(occurrences.body.data[0].occurrenceDate, "2026-02-28");

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
}

run().catch((error) => {
  throw error;
});
