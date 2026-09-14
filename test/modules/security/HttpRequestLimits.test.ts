/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import supertest from "supertest";
import { createServer } from "../../../src/server";

async function runHttpRequestLimitsTest() {
  const app = await createServer({ checkDatabase: async () => undefined });
  const oversizedValue = "x".repeat(65 * 1024);

  const oversizedJsonResponse = await supertest(app)
    .post("/v1/users/authenticate")
    .set("Content-Type", "application/json")
    .send(JSON.stringify({ value: oversizedValue }));

  assert.strictEqual(oversizedJsonResponse.status, 413);
  assert.strictEqual(oversizedJsonResponse.body.error.type, "PayloadTooLarge");
  assert.ok(!JSON.stringify(oversizedJsonResponse.body).includes(oversizedValue));

  const oversizedFormResponse = await supertest(app)
    .post("/v1/users/authenticate")
    .set("Content-Type", "application/x-www-form-urlencoded")
    .send(`value=${oversizedValue}`);

  assert.strictEqual(oversizedFormResponse.status, 413);
  assert.strictEqual(oversizedFormResponse.body.error.type, "PayloadTooLarge");

  const malformedJsonResponse = await supertest(app)
    .post("/v1/users/authenticate")
    .set("Content-Type", "application/json")
    .send('{"email":');

  assert.strictEqual(malformedJsonResponse.status, 400);
  assert.strictEqual(
    malformedJsonResponse.body.error.type,
    "IncompleteRequestBody"
  );
}

runHttpRequestLimitsTest()
  .then(() => console.log("HTTP request limits test passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
