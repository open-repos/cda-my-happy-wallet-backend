import assert from "assert";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { ErrorCode } from "../../../src/utils/errors/errorCode.error";
import { ErrorException } from "../../../src/utils/errors/errorException.error";

async function runPrismaErrorHandlingTest() {
  const express = require("express") as typeof import("express");
  const app = express();

  app.get(
    "/prisma-error",
    (_req: Request, _res: Response, next: NextFunction) => {
      next(
        new Prisma.PrismaClientKnownRequestError(
          "Unique constraint failed on the fields: (`email`)",
          {
            clientVersion: "6.19.3",
            code: "P2002",
            meta: { target: ["email"] },
          }
        )
      );
    }
  );
  app.get("/known-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(
      new ErrorException(
        ErrorCode.IncompleteRequestBody,
        "Invalid request",
        { fields: ["email"] }
      )
    );
  });
  app.get("/unknown-error", (_req: Request, _res: Response, next: NextFunction) => {
    next(new Error("Internal database detail"));
  });
  app.use(errorHandler);

  const response = await supertest(app).get("/prisma-error");

  assert.strictEqual(response.status, 400);
  assert.deepStrictEqual(response.body, {
    response: "error",
    error: {
      message: "Bad Request",
      path: "/prisma-error",
      statusCode: 400,
      type: "PrismaError",
    },
  });

  const knownResponse = await supertest(app).get("/known-error");

  assert.strictEqual(knownResponse.status, 400);
  assert.deepStrictEqual(knownResponse.body.error.details, {
    fields: ["email"],
  });

  const unknownResponse = await supertest(app).get("/unknown-error");

  assert.strictEqual(unknownResponse.status, 500);
  assert.strictEqual(unknownResponse.body.error.type, ErrorCode.UnknownError);
  assert.strictEqual(unknownResponse.body.error.message, "Unknown Error");
  assert.ok(!JSON.stringify(unknownResponse.body).includes("database detail"));
}

runPrismaErrorHandlingTest()
  .then(() => {
    console.log("Prisma error handling test passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
