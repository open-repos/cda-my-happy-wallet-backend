import assert from "assert";
import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";

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
}

runPrismaErrorHandlingTest()
  .then(() => {
    console.log("Prisma error handling test passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
