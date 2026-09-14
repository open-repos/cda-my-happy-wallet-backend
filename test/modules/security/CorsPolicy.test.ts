/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import supertest from "supertest";
import { createServer } from "../../../src/server";

async function runCorsPolicyTest() {
  const app = await createServer({ checkDatabase: async () => undefined });
  const allowedOrigin = "http://localhost:5173";

  const allowedResponse = await supertest(app)
    .get("/v1/")
    .set("Origin", allowedOrigin);

  assert.strictEqual(allowedResponse.status, 200);
  assert.strictEqual(
    allowedResponse.headers["access-control-allow-origin"],
    allowedOrigin
  );
  assert.strictEqual(
    allowedResponse.headers["access-control-allow-credentials"],
    "true"
  );

  const deniedResponse = await supertest(app)
    .get("/v1/")
    .set("Origin", "https://attacker.example");

  assert.strictEqual(deniedResponse.status, 403);
  assert.strictEqual(deniedResponse.body.error.type, "CorsOriginDenied");
  assert.strictEqual(
    deniedResponse.headers["access-control-allow-origin"],
    undefined
  );

  const nativeClientResponse = await supertest(app).get("/v1/");
  assert.strictEqual(nativeClientResponse.status, 200);

  const preflightResponse = await supertest(app)
    .options("/v1/users/authenticate")
    .set("Origin", allowedOrigin)
    .set("Access-Control-Request-Method", "POST")
    .set("Access-Control-Request-Headers", "content-type,authorization");

  assert.strictEqual(preflightResponse.status, 204);
  assert.strictEqual(
    preflightResponse.headers["access-control-allow-methods"],
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  assert.strictEqual(
    preflightResponse.headers["access-control-allow-headers"],
    "Authorization,Content-Type"
  );
  assert.strictEqual(preflightResponse.headers["access-control-max-age"], "600");
}

runCorsPolicyTest()
  .then(() => console.log("CORS policy test passed"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
