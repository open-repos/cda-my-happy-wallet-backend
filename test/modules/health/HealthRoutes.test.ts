/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import supertest from "supertest";
import { createServer } from "../../../src/server";

async function runHealthRoutesTests() {
  const readyServer = await createServer({
    checkDatabase: async () => undefined,
  });

  const liveResponse = await supertest(readyServer).get("/health/live");
  assert.strictEqual(liveResponse.status, 200);
  assert.deepStrictEqual(liveResponse.body, { status: "ok" });
  assert.strictEqual(liveResponse.headers["cache-control"], "no-store");

  const readyResponse = await supertest(readyServer).get("/health/ready");
  assert.strictEqual(readyResponse.status, 200);
  assert.deepStrictEqual(readyResponse.body, { status: "ok" });

  const unavailableServer = await createServer({
    checkDatabase: async () => {
      throw new Error("Database unavailable");
    },
  });
  const unavailableResponse = await supertest(unavailableServer).get(
    "/health/ready"
  );

  assert.strictEqual(unavailableResponse.status, 503);
  assert.deepStrictEqual(unavailableResponse.body, { status: "unavailable" });
  assert.ok(!JSON.stringify(unavailableResponse.body).includes("Database"));
}

runHealthRoutesTests()
  .then(() => {
    console.log("Health routes tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
