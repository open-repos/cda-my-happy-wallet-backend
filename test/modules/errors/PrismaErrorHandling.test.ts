import assert from "assert";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type { AddressInfo } from "net";
import http from "http";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";

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
  path: string
): Promise<HttpResponse> {
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return new Promise<HttpResponse>((resolve, reject) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        method: "GET",
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

async function runPrismaErrorHandlingTest() {
  const express = require("express") as typeof import("express");
  const app = express();

  app.get(
    "/prisma-error",
    (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed on the fields: (`email`)",
          "P2002",
          "3.10.0",
          { target: ["email"] }
        )
      );
    }
  );
  app.use(errorHandler);

  const server = http.createServer(app);
  await startServer(server);

  try {
    const response = await request(server, "/prisma-error");

    assert.strictEqual(response.statusCode, 400);
    assert.deepStrictEqual(JSON.parse(response.body), {
      response: "error",
      error: {
        message: "Bad Request",
        path: "/prisma-error",
        statusCode: 400,
        type: "PrismaError",
      },
    });
  } finally {
    await stopServer(server);
  }
}

runPrismaErrorHandlingTest()
  .then(() => {
    console.log("Prisma error handling test passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
