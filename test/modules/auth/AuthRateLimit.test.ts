import assert from "assert";
import express from "express";
import supertest from "supertest";
import { createAuthRateLimiter } from "../../../src/middlewares/authRateLimit.middleware";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";

async function runAuthRateLimitTest() {
  const app = express();
  app.post(
    "/authenticate",
    createAuthRateLimiter({ windowMs: 60_000, limit: 2 }),
    (_, res) => res.sendStatus(204)
  );
  app.use(errorHandler);

  assert.strictEqual(
    (await supertest(app).post("/authenticate")).status,
    204
  );
  assert.strictEqual(
    (await supertest(app).post("/authenticate")).status,
    204
  );

  const limitedResponse = await supertest(app).post("/authenticate");

  assert.strictEqual(limitedResponse.status, 429);
  assert.strictEqual(limitedResponse.body.error.type, "TooManyRequests");
  assert.strictEqual(limitedResponse.body.error.statusCode, 429);
  assert.match(limitedResponse.headers["retry-after"], /^\d+$/);
  assert.ok(limitedResponse.headers.ratelimit);

  const successfulApp = express();
  successfulApp.post(
    "/authenticate",
    createAuthRateLimiter({
      windowMs: 60_000,
      limit: 1,
      skipSuccessfulRequests: true,
    }),
    (_, res) => res.sendStatus(204)
  );

  assert.strictEqual(
    (await supertest(successfulApp).post("/authenticate")).status,
    204
  );
  assert.strictEqual(
    (await supertest(successfulApp).post("/authenticate")).status,
    204
  );
}

runAuthRateLimitTest()
  .then(() => console.log("Auth rate limit test passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
