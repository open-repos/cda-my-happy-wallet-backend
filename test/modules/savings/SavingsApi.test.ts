/// <reference path="../../../src/utils/custom.d.ts" />
import { toFinancialGoalHttpError } from "../../../src/modules/financialGoals/presentation/financialGoalHttpError";
import { ReconciliationError } from "../../../src/modules/reconciliation/domain/Reconciliation";
import assert from "assert";
import express, { Request, Response, NextFunction } from "express";
import supertest from "supertest";
import { PrismaClient } from "@prisma/client";
import { createSavingsRouter } from "../../../src/routes/savings";
import { PrismaSavingsRepository } from "../../../src/modules/savings/infrastructure/PrismaSavingsRepository";
import { PrismaCurrentAccount } from "../../../src/modules/savings/infrastructure/PrismaCurrentAccount";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorException, ErrorCode } from "../../../src/utils/errors";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw Error("Disposable test database required");
const prisma = new PrismaClient();
async function run() {
  assert.equal(
    (
      toFinancialGoalHttpError(
        new ReconciliationError("NOT_FOUND")
      ) as ErrorException
    ).status,
    404
  );
  const email = "savings-api@test.local";
  await prisma.utilisateur.deleteMany({ where: { email } });
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "API",
      lastname: "Test",
      email,
      password: "test-only",
      verified: true,
    },
  });
  try {
    const app = express();
    app.use(express.json());
    const authenticate = (req: Request, _: Response, next: NextFunction) => {
      if (req.headers.authorization === "Bearer test")
        req.user = { id: user.id };
      else return next(new ErrorException(ErrorCode.Unauthorized));
      next();
    };
    app.use(
      createSavingsRouter(
        new PrismaSavingsRepository(prisma, () => "2026-11-07"),
        new PrismaCurrentAccount(prisma),
        authenticate,
        () => "2026-11-07"
      )
    );
    app.use(errorHandler);
    for (const path of [
      "/savings-accounts",
      "/savings-accounts/1",
      "/savings-accounts/1/movements",
      "/savings-occurrences/pending",
      "/accounts/current",
      "/accounts/current/movements",
    ])
      assert.equal((await supertest(app).get(path)).status, 401);
    for (const [method, path] of [
      ["post", "/savings-accounts"],
      ["patch", "/savings-accounts/1"],
      ["post", "/savings-accounts/1/transfers"],
      ["put", "/savings-accounts/1/goal"],
      ["put", "/savings-accounts/1/occurrences/2026-11"],
    ] as const)
      assert.equal((await supertest(app)[method](path).send({})).status, 401);
    const owner = (request: supertest.Test) =>
      request.set("Authorization", "Bearer test");
    assert.equal(
      (await owner(supertest(app).get("/savings-accounts?limit=0"))).status,
      422
    );
    const created = await owner(supertest(app).post("/savings-accounts")).send({
      name: "Coffre",
      currency: "eur",
      initialBalanceMinorUnits: 10000,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const id = created.body.data.id;
    assert.equal(created.body.data.currency, "EUR");
    assert.equal(created.body.data.userId, undefined);
    for (const extra of [
      { userId: user.id },
      { balanceMinorUnits: 999999 },
      { initialBalanceMinorUnits: "100" },
      { initialBalanceMinorUnits: -1 },
    ])
      assert.equal(
        (
          await owner(supertest(app).post("/savings-accounts")).send({
            name: "Coffre",
            currency: "EUR",
            ...extra,
          })
        ).status,
        422
      );
    assert.equal(
      (
        await owner(supertest(app).patch(`/savings-accounts/${id}`)).send({
          balanceMinorUnits: 5,
        })
      ).status,
      422
    );
    assert.equal(
      (await owner(supertest(app).get("/savings-accounts/0"))).status,
      400
    );
    assert.equal(
      (await owner(supertest(app).get("/savings-accounts/99999999"))).status,
      404
    );
    const input = {
      amountMinorUnits: 123,
      direction: "TO_SAVINGS",
      operationDate: "2026-11-07",
      idempotencyKey: "api-test-transfer",
    };
    const moved = await owner(
      supertest(app).post(`/savings-accounts/${id}/transfers`)
    ).send(input);
    assert.equal(moved.status, 201, JSON.stringify(moved.body));
    assert.equal(moved.body.data.type, "VIREMENT");
    assert.equal(
      (
        await owner(
          supertest(app).post(`/savings-accounts/${id}/transfers`)
        ).send(input)
      ).body.data.id,
      moved.body.data.id
    );
    const conflict = await owner(
      supertest(app).post(`/savings-accounts/${id}/transfers`)
    ).send({ ...input, amountMinorUnits: 124 });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error.details.code, "IDEMPOTENCY_CONFLICT");
    for (const extra of [
      { amountMinorUnits: 1.1 },
      { reason: "GOAL" },
      { operationDate: "2026-02-30" },
      { operationDate: "2026-11-08" },
    ])
      assert.equal(
        (
          await owner(
            supertest(app).post(`/savings-accounts/${id}/transfers`)
          ).send({ ...input, ...extra })
        ).status,
        422
      );
    const listed = await owner(
      supertest(app).get(`/savings-accounts/${id}/movements?limit=1`)
    );
    assert.equal(listed.status, 200);
    assert.deepEqual(Object.keys(listed.body).sort(), ["data", "meta"]);
    assert.equal(
      (
        await owner(
          supertest(app).get("/accounts/current?month=2026-11&currency=EUR")
        )
      ).body.data.balanceMinorUnits,
      -123
    );
    assert.equal(
      (
        await owner(
          supertest(app).get(
            "/accounts/current/movements?month=2026-11&currency=EUR"
          )
        )
      ).body.data[0].signedAmountMinorUnits,
      -123
    );
    assert.equal(
      (
        await owner(
          supertest(app).get("/savings-occurrences/pending?month=2026-99")
        )
      ).status,
      422
    );
    assert.equal(
      (
        await owner(
          supertest(app).put(`/savings-accounts/${id}/occurrences/2026-99`)
        ).send({ status: "CANCELED" })
      ).status,
      422
    );
    assert.equal(
      (await owner(supertest(app).get("/accounts/current?month=2026-12")))
        .status,
      422
    );
    assert.equal(
      (
        await owner(supertest(app).patch(`/savings-accounts/${id}`)).send({
          name: "Coffre renommé",
        })
      ).status,
      200
    );
    const goal = await prisma.objectifFinancier.create({
      data: {
        userId: user.id,
        title: "Objectif HTTP",
        targetAmount: "1000",
        savedAmount: 0,
        monthlyContribution: "10",
        currency: "EUR",
      },
    });
    const link = await owner(
      supertest(app).put(`/savings-accounts/${id}/goal`)
    ).send({ goalId: goal.id });
    assert.equal(link.status, 200, JSON.stringify(link.body));
    const pending = await owner(
      supertest(app).get(
        "/savings-occurrences/pending?month=2026-11&currency=EUR&limit=1"
      )
    );
    assert.equal(pending.status, 200, JSON.stringify(pending.body));
    assert.equal(pending.body.data[0].accountId, id);
    assert.equal(pending.body.data[0].amountMinorUnits, 1000);
    const confirmed = await owner(
      supertest(app).put(`/savings-accounts/${id}/occurrences/2026-11`)
    ).send({ status: "CONFIRMED" });
    assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
    const replay = await owner(
      supertest(app).put(`/savings-accounts/${id}/occurrences/2026-11`)
    ).send({ status: "CONFIRMED" });
    assert.equal(replay.body.data.movement.id, confirmed.body.data.movement.id);
    assert.equal(
      (
        await owner(
          supertest(app).put(`/savings-accounts/${id}/occurrences/2026-11`)
        ).send({ status: "CANCELED" })
      ).status,
      409
    );
    assert.equal(
      (
        await owner(supertest(app).patch(`/savings-accounts/${id}`)).send({
          archived: true,
        })
      ).status,
      200
    );
    const archived = await owner(
      supertest(app).post(`/savings-accounts/${id}/transfers`)
    ).send({ ...input, idempotencyKey: "api-after-archive" });
    assert.equal(archived.status, 409);
    assert.equal(archived.body.error.details.code, "ACCOUNT_ARCHIVED");
    await prisma.utilisateur.delete({ where: { id: user.id } });
    const orphan = await owner(supertest(app).post("/savings-accounts")).send({
      name: "Compte",
      currency: "EUR",
    });
    assert.equal(orphan.status, 404, JSON.stringify(orphan.body));
    console.log(
      "Savings HTTP/MySQL contract, authentication, validation and error tests passed"
    );
  } finally {
    await prisma.utilisateur.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}
run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
