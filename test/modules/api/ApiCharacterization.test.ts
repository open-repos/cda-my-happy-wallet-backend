/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import type { Request, Response } from "express";
import supertest from "supertest";

process.env.ACCESS_TOKEN = "test-access-token-secret";
process.env.REFRESH_TOKEN = "test-refresh-token-secret";
process.env.REGISTER_TOKEN = "test-register-token-secret";
process.env.APP_BASE_URL = "/api/v1";
process.env.DATABASE_URL =
  "mysql://test-user:test-password@127.0.0.1:3306/my_happy_wallet_test";

type LoginModule = typeof import("../../../src/modules/user/useCases/login");
type CreateOperationFixeModule = typeof import("../../../src/modules/operationsFixes/useCases/createOperationFixe");
type ReadAllOperationFixeModule = typeof import("../../../src/modules/operationsFixes/useCases/readAllOperationFixe");
type UpdateOperationFixeModule = typeof import("../../../src/modules/operationsFixes/useCases/updateOperationFixe");
type DeleteAccountModule = typeof import("../../../src/modules/user/useCases/deleteAccount");
type UserRepoModule = typeof import("../../../src/modules/user/userRepo");
type RoutesUserModule = typeof import("../../../src/routes/user");
type RoutesOperationsFixesModule = typeof import("../../../src/routes/operationsFixes");
type RouterModule = typeof import("../../../src/router");
type ErrorHandlerModule = typeof import("../../../src/middlewares/errorHandler.middleware");

const express = require("express") as typeof import("express");
const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");
const { loginController } = require("../../../src/modules/user/useCases/login") as LoginModule;
const {
  createOperationFixeController,
} = require("../../../src/modules/operationsFixes/useCases/createOperationFixe") as CreateOperationFixeModule;
const {
  readAllOperationFixeController,
} = require("../../../src/modules/operationsFixes/useCases/readAllOperationFixe") as ReadAllOperationFixeModule;
const {
  updateOperationFixeController,
} = require("../../../src/modules/operationsFixes/useCases/updateOperationFixe") as UpdateOperationFixeModule;
const {
  deleteAccountController,
} = require("../../../src/modules/user/useCases/deleteAccount") as DeleteAccountModule;
const { UserRepo } = require("../../../src/modules/user/userRepo") as UserRepoModule;
const { userRouter } = require("../../../src/routes/user") as RoutesUserModule;
const { operationFixeRouter } = require("../../../src/routes/operationsFixes") as RoutesOperationsFixesModule;
const { mainRouter } = require("../../../src/router") as RouterModule;
const { errorHandler } = require("../../../src/middlewares/errorHandler.middleware") as ErrorHandlerModule;

const authenticatedUser = {
  id: 42,
  email: "user@example.com",
  password: "hashed-password",
  firstname: "Test",
  lastname: "User",
  role: "USER",
  verified: true,
  resetToken: null,
  resetTokenExpiration: null,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/users", userRouter);
  app.use("/operations-fixes", operationFixeRouter);
  app.use(mainRouter);
  app.use(errorHandler);
  return app;
}

function createAccessToken(userId: number) {
  return jwt.sign({ id: userId }, process.env.ACCESS_TOKEN as string);
}

function createRefreshToken(userId: number) {
  return jwt.sign({ id: userId }, process.env.REFRESH_TOKEN as string);
}

function getSetCookies(response: supertest.Response): string[] {
  const setCookie = response.headers["set-cookie"];
  return Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
}

async function runApiCharacterizationTests() {
  const app = createApp();
  const forgedCookieUserId = 999;
  const requestedUserIds: number[] = [];
  const deleteAccountUserIds: string[] = [];
  const operationCalls: Array<{
    route: string;
    typeOperation?: string;
    userId?: string;
  }> = [];
  const updateCalls: Array<{
    route: string;
    typeOperation: string;
    userId?: string;
  }> = [];

  loginController.execute = async (req: Request, res: Response) => {
    assert.deepStrictEqual(req.body, {
      email: "user@example.com",
      password: "Password!1",
    });

    res.cookie("id_user", authenticatedUser.id, {
      httpOnly: true,
      secure: true,
      maxAge: 900000,
    });
    res.cookie("refresh_token", "fake.refresh.token", {
      httpOnly: true,
      secure: true,
      maxAge: 900000,
    });

    return res.status(200).json({
      success: true,
      payload: {
        user: {
          email: authenticatedUser.email,
          firstname: authenticatedUser.firstname,
          lastname: authenticatedUser.lastname,
        },
        accessToken: "fake.access.token",
        expires: "60s",
      },
    });
  };

  createOperationFixeController.execute = async (
    req: Request,
    res: Response,
    typeOperation: string
  ) => {
    operationCalls.push({
      route: req.path,
      typeOperation,
      userId: req.user?.id.toString(),
    });

    return res.status(201).json({
      success: true,
      message: `${typeOperation} Successfully Created`,
    });
  };

  readAllOperationFixeController.execute = async (
    req: Request,
    res: Response,
    typeOperation?: string
  ) => {
    operationCalls.push({
      route: req.path,
      typeOperation,
      userId: req.user?.id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: `All ${typeOperation || "OperationFixe"} Successfully Read`,
      data: [],
    });
  };

  updateOperationFixeController.execute = async (
    req: Request,
    res: Response,
    typeOperation: string
  ) => {
    updateCalls.push({
      route: req.path,
      typeOperation,
      userId: req.user?.id.toString(),
    });

    return res.status(200).json({
      success: true,
      message: `${typeOperation} Successfully Updated`,
    });
  };

  const deleteAccountControllerWithFakeUseCase = deleteAccountController as unknown as {
    useCase: {
      execute: (body: unknown, userId: string) => Promise<unknown>;
    };
  };
  deleteAccountControllerWithFakeUseCase.useCase.execute = async (_, userId) => {
    deleteAccountUserIds.push(userId);
    return { success: true };
  };

  UserRepo.prototype.getUserByEmail = async () => authenticatedUser;
  UserRepo.prototype.getUserById = async (userId: number) => {
    requestedUserIds.push(userId);
    return authenticatedUser;
  };

  const loginResponse = await supertest(app)
    .post("/users/authenticate")
    .send({ email: "USER@example.com", password: "Password!1" });

  assert.strictEqual(loginResponse.status, 200);
  assert.strictEqual(loginResponse.body.success, true);
  assert.strictEqual(loginResponse.body.payload.accessToken, "fake.access.token");
  assert.ok(
    getSetCookies(loginResponse).some((cookie: string) =>
      cookie.startsWith("refresh_token=")
    )
  );

  const invalidLoginResponse = await supertest(app)
    .post("/users/authenticate")
    .send({ password: "Password!1" });

  assert.strictEqual(invalidLoginResponse.status, 400);
  assert.strictEqual(
    invalidLoginResponse.body.error.type,
    "IncompleteRequestBody"
  );
  assert.deepStrictEqual(invalidLoginResponse.body.error.details.fields, [
    {
      field: "email",
      message: '"email" is required',
      rule: "any.required",
    },
  ]);

  const refreshToken = createRefreshToken(authenticatedUser.id);
  const refreshResponse = await supertest(app)
    .post("/token")
    .set(
      "Cookie",
      [`id_user=${forgedCookieUserId}`, `refresh_token=${refreshToken}`]
    )
    .send({ grant_type: "refresh_token", email: authenticatedUser.email });

  assert.strictEqual(refreshResponse.status, 200);
  assert.strictEqual(refreshResponse.body.success, true);
  assert.strictEqual(refreshResponse.body.payload.user.email, authenticatedUser.email);
  assert.ok(refreshResponse.body.payload.accessToken);
  assert.deepStrictEqual(requestedUserIds, [authenticatedUser.id]);

  const refusedRefreshResponse = await supertest(app)
    .post("/token")
    .send({ grant_type: "refresh_token", email: authenticatedUser.email });

  assert.strictEqual(refusedRefreshResponse.status, 401);
  assert.strictEqual(refusedRefreshResponse.body.error.type, "Unauthorized");

  const accessToken = createAccessToken(authenticatedUser.id);

  const createChargeResponse = await supertest(app)
    .post("/operations-fixes/charges")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", `id_user=${forgedCookieUserId}`)
    .send({ titre: "Loyer", montant: 600, devise: "EUR" });

  assert.strictEqual(createChargeResponse.status, 201);
  assert.strictEqual(createChargeResponse.body.success, true);

  const createRevenuResponse = await supertest(app)
    .post("/operations-fixes/revenus")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", `id_user=${forgedCookieUserId}`)
    .send({ titre: "Salaire", montant: 2000, devise: "EUR" });

  assert.strictEqual(createRevenuResponse.status, 201);
  assert.strictEqual(createRevenuResponse.body.success, true);

  const readChargesResponse = await supertest(app)
    .get("/operations-fixes/charges")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", `id_user=${forgedCookieUserId}`);

  assert.strictEqual(readChargesResponse.status, 200);
  assert.deepStrictEqual(readChargesResponse.body.data, []);

  assert.deepStrictEqual(operationCalls, [
    { route: "/charges", typeOperation: "CHARGE", userId: "42" },
    { route: "/revenus", typeOperation: "REVENU", userId: "42" },
    { route: "/charges", typeOperation: "CHARGE", userId: "42" },
  ]);

  const unauthenticatedOperationsResponse = await supertest(app).get(
    "/operations-fixes/charges"
  );

  assert.strictEqual(unauthenticatedOperationsResponse.status, 403);
  assert.strictEqual(
    unauthenticatedOperationsResponse.body.error.type,
    "AccessForbidden"
  );

  const invalidTokenOperationsResponse = await supertest(app)
    .get("/operations-fixes/charges")
    .set("Authorization", "Bearer invalid-token");

  assert.strictEqual(invalidTokenOperationsResponse.status, 401);
  assert.strictEqual(
    invalidTokenOperationsResponse.body.error.type,
    "Unauthorized"
  );

  const missingUserIdToken = jwt.sign(
    { email: authenticatedUser.email },
    process.env.ACCESS_TOKEN as string
  );
  const invalidPayloadResponse = await supertest(app)
    .get("/operations-fixes/charges")
    .set("Authorization", `Bearer ${missingUserIdToken}`);

  assert.strictEqual(invalidPayloadResponse.status, 401);
  assert.strictEqual(invalidPayloadResponse.body.error.type, "Unauthorized");

  const unauthenticatedUpdateResponse = await supertest(app)
    .put("/operations-fixes/charges/7")
    .send({ titre: "Loyer", montant: 650, devise: "EUR" });

  assert.strictEqual(unauthenticatedUpdateResponse.status, 403);
  assert.strictEqual(
    unauthenticatedUpdateResponse.body.error.type,
    "AccessForbidden"
  );
  assert.deepStrictEqual(updateCalls, []);

  const updateChargeResponse = await supertest(app)
    .put("/operations-fixes/charges/7")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", `id_user=${forgedCookieUserId}`)
    .send({ titre: "Loyer", montant: 650, devise: "EUR" });

  assert.strictEqual(updateChargeResponse.status, 200);

  const updateRevenuResponse = await supertest(app)
    .put("/operations-fixes/revenus/8")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", `id_user=${forgedCookieUserId}`)
    .send({ titre: "Salaire", montant: 2100, devise: "EUR" });

  assert.strictEqual(updateRevenuResponse.status, 200);
  assert.deepStrictEqual(updateCalls, [
    { route: "/charges/7", typeOperation: "CHARGE", userId: "42" },
    { route: "/revenus/8", typeOperation: "REVENU", userId: "42" },
  ]);

  const deleteAccountResponse = await supertest(app)
    .delete("/users/delete")
    .set("Authorization", `Bearer ${accessToken}`)
    .set("Cookie", `id_user=${forgedCookieUserId}`)
    .send({ email: authenticatedUser.email, userId: forgedCookieUserId });

  assert.strictEqual(deleteAccountResponse.status, 200);
  assert.deepStrictEqual(deleteAccountUserIds, [authenticatedUser.id.toString()]);
}

runApiCharacterizationTests()
  .then(() => {
    console.log("API characterization tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
