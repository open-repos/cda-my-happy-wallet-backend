/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import supertest from "supertest";
import { createServer } from "../../../src/server";
import { APP_BASE_URL } from "../../../src/config/config";

async function runHealthRoutesTests() {
  for (const apiDocsEnabled of [false, true]) {
    let databaseChecks = 0;
    let rateLimitChecks = 0;
    const rootServer = await createServer({
      apiDocsEnabled,
      checkDatabase: async () => {
        databaseChecks += 1;
        throw new Error("Private database connection details");
      },
      checkRateLimitStore: async () => {
        rateLimitChecks += 1;
        throw new Error("Private rate limit store details");
      },
    });

    for (const path of [APP_BASE_URL, `${APP_BASE_URL}/`]) {
      const rootResponse = await supertest(rootServer).get(path);
      assert.strictEqual(rootResponse.status, 200);
      assert.match(rootResponse.headers["content-type"], /^application\/json\b/);
      assert.deepStrictEqual(rootResponse.body, {
        name: "My Happy Wallet API",
        version: "v1",
        status: "ok",
        health: {
          live: "/health/live",
          ready: "/health/ready",
        },
      });
    }
    assert.strictEqual(databaseChecks, 0);
    assert.strictEqual(rateLimitChecks, 0);
  }

  const readyServer = await createServer({
    checkDatabase: async () => undefined,
    apiDocsEnabled: true,
  });

  const liveResponse = await supertest(readyServer).get("/health/live");
  assert.strictEqual(liveResponse.status, 200);
  assert.deepStrictEqual(liveResponse.body, { status: "ok" });
  assert.strictEqual(liveResponse.headers["cache-control"], "no-store");
  assert.strictEqual(liveResponse.headers["x-powered-by"], undefined);
  assert.strictEqual(
    liveResponse.headers["x-content-type-options"],
    "nosniff"
  );
  assert.strictEqual(liveResponse.headers["x-frame-options"], "SAMEORIGIN");
  assert.match(
    liveResponse.headers["strict-transport-security"],
    /max-age=31536000/
  );
  assert.ok(liveResponse.headers["content-security-policy"]);

  const swaggerResponse = await supertest(readyServer).get("/api-docs/");
  assert.strictEqual(swaggerResponse.status, 200);
  assert.match(
    swaggerResponse.headers["content-security-policy"],
    /script-src 'self' 'unsafe-inline'/
  );
  const redirectResponse = await supertest(readyServer).get("/");
  assert.strictEqual(redirectResponse.status, 302);
  assert.strictEqual(redirectResponse.headers.location, "/api-docs");

  const docsDisabledServer = await createServer({
    checkDatabase: async () => undefined,
    apiDocsEnabled: false,
  });
  assert.strictEqual(
    (await supertest(docsDisabledServer).get("/api-docs/")).status,
    404
  );
  assert.strictEqual((await supertest(docsDisabledServer).get("/")).status, 404);

  const readyResponse = await supertest(readyServer).get("/health/ready");
  assert.strictEqual(readyResponse.status, 200);
  assert.deepStrictEqual(readyResponse.body, { status: "ok" });
  assert.strictEqual(readyResponse.headers["cache-control"], "no-store");

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
  assert.strictEqual(unavailableResponse.headers["cache-control"], "no-store");
  assert.ok(!JSON.stringify(unavailableResponse.body).includes("Database"));

  const unavailableLiveResponse = await supertest(unavailableServer).get(
    "/health/live"
  );
  assert.strictEqual(unavailableLiveResponse.status, 200);
  assert.deepStrictEqual(unavailableLiveResponse.body, { status: "ok" });
  assert.strictEqual(unavailableLiveResponse.headers["cache-control"], "no-store");
}

runHealthRoutesTests()
  .then(() => {
    console.log("Health routes tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
