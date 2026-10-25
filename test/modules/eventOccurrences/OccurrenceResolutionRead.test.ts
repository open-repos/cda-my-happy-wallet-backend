/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { OccurrenceResolutionReadController } from "../../../src/modules/eventOccurrences/presentation/OccurrenceResolutionReadController";
import { ListOccurrenceResolutions } from "../../../src/modules/eventOccurrences/application/ListOccurrenceResolutions";
import { parseResolutionQuery } from "../../../src/modules/eventOccurrences/presentation/eventOccurrenceValidators";
import { OccurrenceResolution } from "../../../src/modules/eventOccurrences/domain";
import { createEventOccurrenceRouter } from "../../../src/routes/eventOccurrences";
import { EventOccurrenceController } from "../../../src/modules/eventOccurrences/presentation";
const express = require("express") as typeof import("express");
const run = async () => {
  const calls: unknown[] = [];
  const row: OccurrenceResolution = {
    id: 9,
    ownerId: 7,
    sourceEventId: 10,
    occurrenceDate: "2026-10-25",
    status: "REALIZED",
    title: "Prévu",
    minorUnits: 10000,
    currency: "EUR",
    kind: "DEPENSE",
    resolvedAt: new Date("2026-10-25T12:00:00Z"),
    operation: {
      id: 100,
      title: "Réel modifié",
      minorUnits: 7500,
      operationDate: "2026-11-01",
      categoryId: 1,
    },
  };
  const controller = new OccurrenceResolutionReadController(
    new ListOccurrenceResolutions({
      listResolved: async (...args) => {
        calls.push(args);
        return {
          data:
            args[0] === 7
              ? [row, { ...row, id: 11, status: "CANCELED", operation: null }]
              : [],
          meta: { limit: 2, hasNext: true, nextCursor: "opaque" },
        };
      },
    })
  );
  const auth = (req: Request, _: Response, next: NextFunction) => {
    if (!req.headers.authorization)
      return next(new ErrorException(ErrorCode.Unauthorized));
    req.user = { id: req.headers.authorization === "other" ? 8 : 7 };
    next();
  };
  const app = express();
  app.use(
    createEventOccurrenceRouter(
      {} as EventOccurrenceController,
      auth,
      controller
    )
  );
  app.use(errorHandler);
  const url =
    "/event-occurrence-resolutions?from=2026-10-01&to=2026-10-31&limit=2&cursor=opaque-before";
  assert.strictEqual((await supertest(app).get(url)).status, 401);
  assert.strictEqual(calls.length, 0);
  const response = await supertest(app).get(url).set("Authorization", "owner");
  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(calls[0], [
    7,
    "2026-10-01",
    "2026-10-31",
    { limit: 2, cursor: "opaque-before" },
  ]);
  assert.deepStrictEqual(response.body.data[0], {
    eventId: 10,
    occurrenceDate: "2026-10-25",
    status: "REALIZED",
    title: "Prévu",
    amount: "100.00",
    currency: "EUR",
    kind: "DEPENSE",
    resolvedAt: "2026-10-25T12:00:00.000Z",
    operation: {
      id: 100,
      title: "Réel modifié",
      amount: "75.00",
      operationDate: "2026-11-01",
      categoryId: 1,
    },
  });
  assert.strictEqual(response.body.data[1].operation, null);
  assert.strictEqual(response.body.data[1].status, "CANCELED");
  assert.deepStrictEqual(response.body.meta, {
    limit: 2,
    hasNext: true,
    nextCursor: "opaque",
  });
  assert.deepStrictEqual(
    (await supertest(app).get(url).set("Authorization", "other")).body.data,
    []
  );
  for (const query of [
    {},
    { from: "2026-02-30", to: "2026-03-01" },
    { from: "2026-10-25", to: "2026-10-24" },
    { from: "2025-01-01", to: "2026-01-02" },
    { from: "2026-10-01", to: "2026-10-31", unknown: "x" },
    { from: ["2026-10-01"], to: "2026-10-31" },
    { from: "2026-10-01", to: "2026-10-31", limit: "101" },
  ])
    assert.throws(() => parseResolutionQuery(query));
  assert.deepStrictEqual(
    parseResolutionQuery({ from: "2024-02-29", to: "2024-02-29" }),
    {
      from: "2024-02-29",
      to: "2024-02-29",
      pagination: { limit: 50, cursor: null },
    }
  );
  console.log(
    "Occurrence resolution read API: authenticated scope, snapshots, nullable links, civil dates and pagination passed."
  );
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
