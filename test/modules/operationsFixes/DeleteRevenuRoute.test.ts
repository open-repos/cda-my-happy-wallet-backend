/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import type { Request, Response } from "express";
import supertest from "supertest";

process.env.ACCESS_TOKEN = "test-access-token-secret-at-least-32-characters";
process.env.DATABASE_URL =
  "mysql://test-user:test-password@127.0.0.1:3306/my_happy_wallet_test";

type DeleteControllerModule = typeof import("../../../src/modules/operationsFixes/useCases/deleteOperationFixe");
type OperationsFixesRoutesModule = typeof import("../../../src/routes/operationsFixes");

async function runDeleteRevenuRouteTest() {
  const express = require("express") as typeof import("express");
  const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
  const jwt = require("jsonwebtoken") as typeof import("jsonwebtoken");
  const deleteOperationFixeModule = require("../../../src/modules/operationsFixes/useCases/deleteOperationFixe") as DeleteControllerModule;
  const { operationFixeRouter } = require("../../../src/routes/operationsFixes") as OperationsFixesRoutesModule;

  const calls: Array<{ id: string; method: string; typeOperation: string }> = [];
  deleteOperationFixeModule.deleteOperationFixeController.execute = async (
    req: Request,
    res: Response,
    typeOperation: string
  ) => {
    calls.push({
      id: req.params.id,
      method: req.method,
      typeOperation,
    });

    return res.status(200).json({ success: true });
  };

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/operations-fixes", operationFixeRouter);

  const token = jwt.sign({ id: 42 }, process.env.ACCESS_TOKEN as string);
  const response = await supertest(app)
    .delete("/operations-fixes/revenus/7")
    .set("Authorization", `Bearer ${token}`)
    .set("Cookie", "id_user=42");

  assert.strictEqual(response.status, 200);
  assert.deepStrictEqual(response.body, { success: true });
  assert.deepStrictEqual(calls, [
    {
      id: "7",
      method: "DELETE",
      typeOperation: "REVENU",
    },
  ]);
}

runDeleteRevenuRouteTest()
  .then(() => {
    console.log("Delete revenu route test passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
