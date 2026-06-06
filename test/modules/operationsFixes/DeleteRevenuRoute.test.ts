/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import type { Request, Response } from "express";
import type { AddressInfo } from "net";
import http from "http";

process.env.ACCESS_TOKEN = "test-access-token-secret";
process.env.DATABASE_URL =
  "mysql://test-user:test-password@127.0.0.1:3306/my_happy_wallet_test";

type DeleteControllerModule = typeof import("../../../src/modules/operationsFixes/useCases/deleteOperationFixe");
type OperationsFixesRoutesModule = typeof import("../../../src/routes/operationsFixes");

type HttpResponse = {
  body: string;
  statusCode: number;
};

async function startServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
}

async function stopServer(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

async function request(
  server: http.Server,
  method: string,
  path: string,
  authorizationToken: string
): Promise<HttpResponse> {
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return new Promise<HttpResponse>((resolve, reject) => {
    const req = http.request(
      {
        headers: {
          Authorization: `Bearer ${authorizationToken}`,
          Cookie: "id_user=42",
        },
        hostname: "127.0.0.1",
        method,
        path,
        port: (address as AddressInfo).port,
      },
      (res) => {
        let body = "";

        res.on("data", (chunk: string | Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          resolve({
            body,
            statusCode: res.statusCode ?? 0,
          });
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

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

  const server = http.createServer(app);
  await startServer(server);

  try {
    const token = jwt.sign({ id: 42 }, process.env.ACCESS_TOKEN as string);
    const response = await request(
      server,
      "DELETE",
      "/operations-fixes/revenus/7",
      token
    );

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(JSON.parse(response.body), { success: true });
    assert.deepStrictEqual(calls, [
      {
        id: "7",
        method: "DELETE",
        typeOperation: "REVENU",
      },
    ]);
  } finally {
    await stopServer(server);
  }
}

runDeleteRevenuRouteTest()
  .then(() => {
    console.log("Delete revenu route test passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
