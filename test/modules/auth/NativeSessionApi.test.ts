/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import supertest from "supertest";

process.env.ACCESS_TOKEN = "native-access-token-secret-at-least-32-characters";
process.env.REFRESH_TOKEN = "native-refresh-token-secret-at-least-32-characters";
process.env.REGISTER_TOKEN = "native-register-token-secret-at-least-32-characters";
process.env.DATABASE_URL =
  "mysql://test-user:test-password@127.0.0.1:3306/my_happy_wallet_test";

type ExpressModule = typeof import("express");
type ErrorHandlerModule = typeof import("../../../src/middlewares/errorHandler.middleware");
type NativeSessionModule = typeof import("../../../src/modules/auth/nativeSession");
type NativeSessionRoutesModule = typeof import("../../../src/routes/nativeSession");

const express = require("express") as ExpressModule;
const { errorHandler } = require("../../../src/middlewares/errorHandler.middleware") as ErrorHandlerModule;
const { NativeSessionController } = require("../../../src/modules/auth/nativeSession") as NativeSessionModule;
const { createNativeSessionRouter } = require("../../../src/routes/nativeSession") as NativeSessionRoutesModule;

async function runNativeSessionApiTests() {
  const calls = {
    login: [] as unknown[],
    refresh: [] as string[],
    revoke: [] as string[],
  };
  const controller = new NativeSessionController(
    {
      execute: async (body) => {
        calls.login.push(body);
        return {
          success: true,
          payload: {
            user: { email: "user@example.com", firstname: "Test" },
            accessToken: "native.access.token",
            expires: "60s",
          },
          refreshToken: "native.refresh.token",
        };
      },
    },
    {
      execute: async (refreshToken) => {
        calls.refresh.push(refreshToken);
        return {
          userId: 42,
          user: { email: "user@example.com", firstname: "Test" },
          accessToken: "renewed.access.token",
          accessTokenExpires: "5min",
          accessTokenExpiresIn: 300,
          refreshToken: "rotated.refresh.token",
        };
      },
    },
    {
      revoke: async (refreshToken) => {
        calls.revoke.push(refreshToken);
      },
    }
  );
  const app = express();
  app.use(express.json());
  app.use("/auth/native", createNativeSessionRouter(controller));
  app.use(errorHandler);

  const loginResponse = await supertest(app)
    .post("/auth/native/sessions")
    .send({ email: "USER@example.com", password: "Password!1" });

  assert.strictEqual(loginResponse.status, 200);
  assert.deepStrictEqual(calls.login, [
    { email: "user@example.com", password: "Password!1" },
  ]);
  assert.strictEqual(loginResponse.headers["set-cookie"], undefined);
  assert.strictEqual(loginResponse.body.payload.accessToken, "native.access.token");
  assert.strictEqual(loginResponse.body.payload.refreshToken, "native.refresh.token");
  assert.strictEqual(loginResponse.body.payload.accessTokenExpiresIn, 60);
  assert.strictEqual(loginResponse.body.payload.refreshTokenExpiresIn, 900);

  const invalidLoginResponse = await supertest(app)
    .post("/auth/native/sessions")
    .send({ password: "Password!1" });
  assert.strictEqual(invalidLoginResponse.status, 400);
  assert.strictEqual(invalidLoginResponse.body.error.type, "IncompleteRequestBody");

  const refreshResponse = await supertest(app)
    .post("/auth/native/sessions/refresh")
    .send({ refreshToken: "native.refresh.token" });

  assert.strictEqual(refreshResponse.status, 200);
  assert.deepStrictEqual(calls.refresh, ["native.refresh.token"]);
  assert.strictEqual(refreshResponse.headers["set-cookie"], undefined);
  assert.strictEqual(refreshResponse.body.payload.accessToken, "renewed.access.token");
  assert.strictEqual(refreshResponse.body.payload.refreshToken, "rotated.refresh.token");
  assert.strictEqual(refreshResponse.body.payload.accessTokenExpiresIn, 300);
  assert.strictEqual(refreshResponse.body.payload.refreshTokenExpiresIn, 900);

  const invalidRefreshResponse = await supertest(app)
    .post("/auth/native/sessions/refresh")
    .send({ refreshToken: "" });
  assert.strictEqual(invalidRefreshResponse.status, 400);
  assert.strictEqual(
    invalidRefreshResponse.body.error.type,
    "IncompleteRequestBody"
  );

  const revokeResponse = await supertest(app)
    .post("/auth/native/sessions/revoke")
    .send({ refreshToken: "rotated.refresh.token" });
  assert.strictEqual(revokeResponse.status, 204);
  assert.deepStrictEqual(calls.revoke, ["rotated.refresh.token"]);

  const invalidRevokeResponse = await supertest(app)
    .post("/auth/native/sessions/revoke")
    .send({});
  assert.strictEqual(invalidRevokeResponse.status, 400);
}

runNativeSessionApiTests()
  .then(() => {
    console.log("Native session API tests passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
