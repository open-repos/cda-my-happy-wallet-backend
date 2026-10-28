/// <reference path="../../../src/utils/custom.d.ts" />
import { EnvelopeReportingController } from "../../../src/modules/reconciliation/presentation/EnvelopeReportingController";
import assert from "assert";
import express, { RequestHandler } from "express";
import supertest from "supertest";
import { createReconciliationRouter } from "../../../src/routes/reconciliation";
import { ReconciliationController } from "../../../src/modules/reconciliation/presentation/ReconciliationController";
import { ReconciliationRepository } from "../../../src/modules/reconciliation/application/ReconciliationRepository";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import swagger from "../../../src/utils/swagger.def";
const calls: unknown[][] = [];
const page = {
  data: [],
  meta: { limit: 50, hasNext: false, nextCursor: null },
};
const repo = new Proxy({} as ReconciliationRepository, {
  get:
    (_, method: string) =>
    async (...args: unknown[]) => {
      calls.push([method, ...args]);
      return method === "saveEnvelope"
        ? { id: 5, ...(args[1] as object) }
        : page;
    },
});
const auth: RequestHandler = (req, _, next) => {
  if (req.headers.authorization !== "Bearer test")
    return next(new ErrorException(ErrorCode.Unauthorized));
  req.user = { id: 7 };
  next();
};
const app = express();
app.use(express.json());
app.use(
  createReconciliationRouter(
    new ReconciliationController(repo, () => "2026-10-27"),
    auth,
    new EnvelopeReportingController(
      {
        overview: async (owner, query, pagination) => {
          calls.push(["overview", owner, query, pagination]);
          return page;
        },
        analytics: async (owner, query, pagination) => {
          calls.push(["analytics", owner, query, pagination]);
          return page;
        },
        fixedMonth: async (owner, month, pagination) => {
          calls.push(["fixedMonth", owner, month, pagination]);
          return page;
        },
      },
      () => "2026-10-27"
    )
  )
);
app.use(errorHandler);
const request = supertest(app);
const get = (url: string) =>
  request.get(url).set("Authorization", "Bearer test");
const input = {
  title: "Courses",
  amount: 0.29,
  currency: "eur",
  startMonth: "2026-10",
};
async function run() {
  assert.strictEqual((await request.get("/budget-envelopes")).status, 401);
  const result = await request
    .post("/budget-envelopes")
    .set("Authorization", "Bearer test")
    .send(input);
  assert.strictEqual(result.status, 201);
  assert.strictEqual(result.headers.location, "/budget-envelopes/5");
  assert.deepStrictEqual(calls.pop(), [
    "saveEnvelope",
    7,
    {
      ...input,
      amount: "0.29",
      currency: "EUR",
      categoryId: null,
      endMonth: null,
    },
    undefined,
  ]);
  for (const patch of [
    { amount: 1.001 },
    { amount: -1 },
    { ownerId: 8 },
    { currency: "€€€" },
    { startMonth: "2026-13" },
    { endMonth: "2026-09" },
    { categoryId: 2147483648 },
    { archived: true },
  ]) {
    assert.strictEqual(
      (
        await request
          .post("/budget-envelopes")
          .set("Authorization", "Bearer test")
          .send({ ...input, ...patch })
      ).status,
      422
    );
  }
  for (const url of [
    "/budget-envelopes?limit=101",
    "/budget-envelopes?month=2026-10&month=2026-11",
    "/reconciliation/months/2026-13/occurrences?currency=EUR",
    "/reconciliation/months/2028-10/occurrences?currency=EUR",
    "/reconciliation/months/2026-10/occurrences?currency=EUR&currency=USD",
    "/reconciliation/months/2026-10/occurrences",
    "/reconciliation/occurrences/1/operations?unassociated=1",
    "/operations/1/reconciliation-suggestions?unknown=true",
    "/reconciliation/fixed-eligibility?owner=8",
    "/budget-envelopes/1?unexpected=1",
    "/reconciliation/months/2026-10/summary?currency=EUR&limit=1",
  ]) {
    const before = calls.length;
    assert.strictEqual((await get(url)).status, 422, url);
    assert.strictEqual(calls.length, before, url);
  }
  assert.strictEqual((await get("/budget-envelopes/no-id")).status, 400);
  const occurrences = await get(
    "/reconciliation/months/2026-10/occurrences?currency=eur"
  );
  assert.strictEqual(occurrences.status, 200);
  assert.strictEqual(occurrences.body.integration.globalBudgetAdjusted, true);
  assert.deepStrictEqual(calls.pop(), [
    "listOccurrences",
    7,
    "2026-10",
    "EUR",
    { limit: 50, cursor: null },
  ]);
  const link = (body: object) =>
    request
      .put("/operations/8/reconciliation")
      .set("Authorization", "Bearer test")
      .send(body);
  assert.strictEqual((await link({ occurrenceId: 1 })).status, 422);
  assert.strictEqual(
    (await link({ occurrenceId: null, expectedOccurrenceId: 1 })).status,
    204
  );
  assert.deepStrictEqual(calls.pop(), ["link", 7, 8, null, 1]);
  assert.strictEqual(
    (await get("/operations/8/reconciliation-suggestions")).body.automatic,
    false
  );
  for (const url of [
    "/envelope-overview?month=2026-10&year=2026&currency=EUR",
    "/envelope-overview?year=2026&currency=EUR&currency=USD",
    "/envelope-overview?month=2026-13&currency=EUR",
    "/envelope-analytics?from=2025-01&to=2026-12&currency=EUR",
    "/envelope-analytics?from=2026-10&to=2026-09&currency=EUR",
    "/operations-fixes/months/2026-13",
  ]) {
    assert.strictEqual((await get(url)).status, 422, url);
  }
  assert.strictEqual(
    (await get("/envelope-overview?currency=EUR")).status,
    200
  );
  assert.deepStrictEqual(calls.pop(), [
    "overview",
    7,
    { from: "2026-10", to: "2026-10", currency: "EUR" },
    { limit: 50, cursor: null },
  ]);
  assert.strictEqual(
    (await get("/envelope-overview?year=2026&currency=EUR")).status,
    200
  );
  assert.deepStrictEqual(calls.pop(), [
    "overview",
    7,
    { from: "2026-01", to: "2026-12", currency: "EUR" },
    { limit: 50, cursor: null },
  ]);
  assert.strictEqual(
    (await get("/envelope-analytics?from=2026-01&to=2026-12&currency=EUR"))
      .status,
    200
  );
  assert.strictEqual(
    (await get("/operations-fixes/months/2026-11")).status,
    200
  );
  const paths = swagger.paths as Record<string, any>;
  assert.ok(paths["/operations/{id}/reconciliation"].put.requestBody);
  const schemas = swagger.components.schemas as Record<string, any>;
  for (const name of [
    "BudgetEnvelopeInput",
    "BudgetEnvelope",
    "ReconciliationMetrics",
    "ReconciliationOccurrence",
    "ReconciliationOperation",
    "ReconciliationSummary",
    "ReconciliationIntegration",
  ])
    assert.ok(schemas[name]);
  for (const path of Object.keys(paths).filter(
    (p) => p.includes("reconciliation") || p.includes("budget-envelopes")
  )) {
    for (const operation of Object.values(paths[path]) as any[]) {
      assert.ok(operation.security);
      assert.ok(operation.responses["422"]);
    }
  }
  console.log(
    "Reconciliation HTTP: authentication, strict validation, normalization, compare-and-set, tracking marker and OpenAPI passed"
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
