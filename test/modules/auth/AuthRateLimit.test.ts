import assert from "assert";
import express from "express";
import supertest from "supertest";
import { RedisStore } from "rate-limit-redis";
import { createClient } from "redis";
import { createAuthRateLimiter } from "../../../src/middlewares/authRateLimit.middleware";
import { disconnectRateLimitStore } from "../../../src/infrastructure/rateLimit/redisRateLimitStore";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";

async function runAuthRateLimitTest() {
  const app = express();
  app.post(
    "/authenticate",
    createAuthRateLimiter({ windowMs: 60_000, limit: 2 }),
    (_, res) => res.sendStatus(204)
  );
  app.use(errorHandler);

  assert.strictEqual((await supertest(app).post("/authenticate")).status, 204);
  assert.strictEqual((await supertest(app).post("/authenticate")).status, 204);

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

  const redisUrl = process.env.REDIS_URL;
  assert.ok(
    redisUrl,
    "REDIS_URL is required for the distributed rate-limit test"
  );

  const clients = [
    createClient({ url: redisUrl }),
    createClient({ url: redisUrl }),
  ];
  await Promise.all(clients.map((client) => client.connect()));

  try {
    await clients[0].flushDb();
    const prefix = `mhw:test:auth-rate-limit:${Date.now()}:`;
    const createRedisStore = (client: (typeof clients)[number]) =>
      new RedisStore({
        prefix,
        sendCommand: (...args: string[]) => client.sendCommand(args),
      });
    const replicas = clients.map((client) => {
      const replica = express();
      replica.post(
        "/authenticate",
        createAuthRateLimiter({
          windowMs: 60_000,
          limit: 2,
          store: createRedisStore(client),
        }),
        (_, res) => res.sendStatus(204)
      );
      replica.use(errorHandler);
      return replica;
    });

    assert.strictEqual(
      (await supertest(replicas[0]).post("/authenticate")).status,
      204
    );
    assert.strictEqual(
      (await supertest(replicas[1]).post("/authenticate")).status,
      204
    );
    assert.strictEqual(
      (await supertest(replicas[0]).post("/authenticate")).status,
      429,
      "both replicas must share the same request counter"
    );
  } finally {
    await Promise.all(clients.map((client) => client.close()));
  }
}

runAuthRateLimitTest()
  .then(() => console.log("Auth rate limit test passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => disconnectRateLimitStore());
