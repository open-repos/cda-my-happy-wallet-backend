/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import express, { RequestHandler } from "express";
import supertest from "supertest";
import { FakeRepository } from "./MonthlyEventApi.test";
import { MonthlyEventUseCases } from "../../../src/modules/monthlyEvents/application";
import { MonthlyEventController } from "../../../src/modules/monthlyEvents/presentation";
import { createMonthlyEventRouter } from "../../../src/routes/monthlyEvents";
import { createBudgetForecastRouter } from "../../../src/routes/budgetForecast";
import { createSavingsCapacityRouter } from "../../../src/routes/savingsCapacity";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { SavingsCapacityService } from "../../../src/modules/financialGoals/application/SavingsCapacityService";
import { ForecastReads } from "../budgetPeriods/MultiMonthForecast.test";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const run = async () => {
  const repository = new FakeRepository();
  const clock = () => "2026-10-19";
  const authenticate: RequestHandler = (req, _res, next) => {
    if (req.headers.authorization === "Bearer owner") req.user = { id: 7 };
    else if (req.headers.authorization === "Bearer other") req.user = { id: 8 };
    else return next(new ErrorException(ErrorCode.Unauthorized));
    next();
  };
  const app = express();
  app.use(express.json());
  app.use(
    createMonthlyEventRouter(
      new MonthlyEventController(new MonthlyEventUseCases(repository, clock)),
      authenticate
    )
  );
  const reads = new ForecastReads();
  reads.potential["2026-10"] = [
    {
      occurrenceDate: "2026-10-31",
      kind: "DEPENSE",
      minorUnits: 5000,
      count: 1,
    },
  ];
  const forecast = new BudgetForecastService(reads);
  app.use(createBudgetForecastRouter(forecast, authenticate, clock));
  app.use(
    createSavingsCapacityRouter(
      new SavingsCapacityService(forecast, {
        listForSavingsCapacity: async () => [],
      }),
      authenticate,
      clock
    )
  );
  app.use(errorHandler);
  const request = supertest(app);
  const auth = "Bearer owner";
  const input = {
    title: "Voyage potentiel",
    amount: "50.00",
    currency: "EUR",
    kind: "DEPENSE",
    startDate: "2026-10-31",
    recurrence: "ANNUELLE",
    endDate: "2028-10-31",
    status: "POTENTIEL",
  };
  await request.post("/events/1/confirm").expect(401);
  await request.delete("/simulation/events").expect(401);
  await request
    .post("/events/1/confirm")
    .set("Authorization", auth)
    .send({ amount: "1.00" })
    .expect(422);
  await request
    .delete("/simulation/events?ownerId=8")
    .set("Authorization", auth)
    .expect(422);
  const created = (
    await request
      .post("/events")
      .set("Authorization", auth)
      .send(input)
      .expect(201)
  ).body.data;
  assert.strictEqual(created.status, "POTENTIEL");
  assert.deepStrictEqual(
    (await request.get("/events").set("Authorization", auth).expect(200)).body
      .data,
    []
  );
  assert.deepStrictEqual(
    (
      await request
        .get("/events?status=POTENTIEL")
        .set("Authorization", auth)
        .expect(200)
    ).body.data,
    [created]
  );
  assert.deepStrictEqual(
    (
      await request
        .get("/event-occurrences?month=2026-10")
        .set("Authorization", auth)
        .expect(200)
    ).body.data,
    []
  );
  assert.strictEqual(
    (
      await request
        .get("/event-occurrences?month=2026-10&scenario=simulation")
        .set("Authorization", auth)
        .expect(200)
    ).body.data[0].status,
    "POTENTIEL"
  );
  await request
    .get("/events?status=all")
    .set("Authorization", auth)
    .expect(422);
  await request
    .get("/event-occurrences?month=2026-10&scenario[]=simulation")
    .set("Authorization", auth)
    .expect(422);
  for (const method of ["get", "put", "delete"] as const)
    await request[method]("/events/1")
      .set("Authorization", "Bearer other")
      .send(input)
      .expect(404);
  await request
    .post("/events/1/confirm")
    .set("Authorization", "Bearer other")
    .expect(404);
  await request
    .put("/events/1")
    .set("Authorization", auth)
    .send({ ...input, status: "CONFIRME" })
    .expect(422);
  const { status: _status, ...withoutStatus } = input;
  assert.strictEqual(
    (
      await request
        .put("/events/1")
        .set("Authorization", auth)
        .send(withoutStatus)
        .expect(200)
    ).body.data.status,
    "POTENTIEL"
  );
  const confirmed = (
    await request
      .post("/events/1/confirm")
      .set("Authorization", auth)
      .expect(200)
  ).body.data;
  assert.deepStrictEqual(confirmed, { ...created, status: "CONFIRME" });
  assert.deepStrictEqual(
    (
      await request
        .post("/events/1/confirm")
        .set("Authorization", auth)
        .expect(200)
    ).body.data,
    confirmed
  );
  await request
    .put("/events/1")
    .set("Authorization", auth)
    .send(input)
    .expect(422);
  await request
    .post("/events")
    .set("Authorization", auth)
    .send({ ...input, startDate: "2026-09-30" })
    .expect(422);
  await request
    .post("/events")
    .set("Authorization", auth)
    .send(input)
    .expect(201);
  await request
    .post("/events")
    .set("Authorization", "Bearer other")
    .send(input)
    .expect(201);
  await request
    .delete("/simulation/events")
    .set("Authorization", auth)
    .expect(204);
  await request
    .delete("/simulation/events")
    .set("Authorization", auth)
    .expect(204);
  assert.strictEqual(
    repository.rows.filter((event) => event.ownerId === 7).length,
    1
  );
  assert.strictEqual(
    repository.rows.filter((event) => event.ownerId === 8).length,
    1
  );
  for (const path of ["/budget-forecast", "/savings-capacity"]) {
    const query = `${path}?from=2026-10&months=2&currency=EUR`;
    const normal = (
      await request.get(query).set("Authorization", auth).expect(200)
    ).body.data;
    const simulation = (
      await request
        .get(`${query}&scenario=simulation`)
        .set("Authorization", auth)
        .expect(200)
    ).body.data;
    const field =
      path === "/budget-forecast" ? "forecastRemaining" : "beforeGoals";
    assert.strictEqual(
      Number(normal.months[0][field]) - Number(simulation.months[0][field]),
      50
    );
    assert.strictEqual(
      Number(normal.months[1][field]) - Number(simulation.months[1][field]),
      50
    );
    await request
      .get(`${query}&scenario=anything`)
      .set("Authorization", auth)
      .expect(422);
    await request
      .get(`${query}&scenario=standard&scenario=simulation`)
      .set("Authorization", auth)
      .expect(422);
  }
};
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
