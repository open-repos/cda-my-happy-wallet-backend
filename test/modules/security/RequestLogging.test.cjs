const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const supertest = require("supertest");
require("ts-node").register({ files: true });

const root = path.resolve(__dirname, "../../..");
assert.ok(
  !fs.existsSync(path.join(root, ".env")),
  "Use an isolated checkout without a .env file for request logging tests"
);
const markers = [
  "RESET_SECRET_MARKER",
  "CONFIRM_SECRET_MARKER",
  "TENANT_PRIVATE_MARKER",
  "987654321",
  "only-private@example.invalid",
  "only-private%40example.invalid",
  "9876.54",
  "BODY_PRIVATE_MARKER",
  "AUTH_PRIVATE_MARKER",
  "COOKIE_PRIVATE_MARKER",
  "AGENT_PRIVATE_MARKER",
  "REFERER_PRIVATE_MARKER",
  "192.0.2.55",
  "QUERY_PRIVATE_MARKER",
];

function assertPrivate(text) {
  for (const marker of markers) {
    assert.ok(!text.includes(marker), "A private request marker reached a log");
  }
}

function assertRecord(line, method, route, status) {
  assert.equal(line.split("\n").length, 2, "Exactly one JSON line per request");
  assert.ok(line.endsWith("\n"));
  assertPrivate(line);
  const record = JSON.parse(line);
  assert.deepEqual(Object.keys(record).sort(), [
    "event",
    "method",
    "responseTimeMs",
    "route",
    "status",
  ]);
  assert.equal(record.event, "http_request");
  assert.equal(record.method, method);
  assert.equal(record.route, route);
  assert.equal(record.status, status);
  assert.equal(typeof record.responseTimeMs, "number");
  assert.ok(record.responseTimeMs >= 0);
}

async function middlewarePrivacy() {
  const {
    createDevelopmentRequestLogger,
  } = require("../../../src/middlewares/requestLogger.middleware");
  const lines = [];
  const app = express();
  app.use(
    createDevelopmentRequestLogger({ write: (line) => lines.push(line) })
  );
  app.use(express.json());
  const users = express.Router();
  users.get("/verify/:id/:token", (_, res) => res.sendStatus(204));
  users.get("/reset-password/:token", (_, res) => res.sendStatus(401));
  app.use("/tenants/:tenantId/users", users);
  app.post("/operations/:id", (_, res) =>
    res.status(201).json({ saved: true })
  );
  app.get("/failure/:id", (_, __, next) =>
    next(new Error("BODY_PRIVATE_MARKER"))
  );
  app.all("/method", (_, res) => res.sendStatus(204));
  app.get(["/legacy/:id", "/alternative/:id"], (_, res) => res.sendStatus(204));
  app.get(/^\/pattern\/(.+)$/, (_, res) => res.sendStatus(204));
  app.use((_, res) => res.sendStatus(404));
  app.use((_, __, res, ___) => res.status(500).json({ error: "unavailable" }));

  const check = async (request, method, route, status) => {
    const before = lines.length;
    const response = await request;
    assert.equal(response.status, status);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(lines.length, before + 1);
    assertRecord(lines.at(-1), method, route, status);
  };
  const prefix = "/tenants/TENANT_PRIVATE_MARKER/users";
  await check(
    supertest(app).get(
      `${prefix}/verify/987654321/CONFIRM_SECRET_MARKER?email=only-private%40example.invalid`
    ),
    "GET",
    "/verify/:id/:token",
    204
  );
  await check(
    supertest(app).get(
      `${prefix}/reset-password/RESET_SECRET_MARKER?token=QUERY_PRIVATE_MARKER`
    ),
    "GET",
    "/reset-password/:token",
    401
  );
  await check(
    supertest(app)
      .post("/operations/987654321?amount=9876.54")
      .set("Authorization", "Bearer AUTH_PRIVATE_MARKER")
      .set("Cookie", "session=COOKIE_PRIVATE_MARKER")
      .set("User-Agent", "AGENT_PRIVATE_MARKER")
      .set("Referer", "https://example.invalid/REFERER_PRIVATE_MARKER")
      .set("X-Forwarded-For", "192.0.2.55")
      .send({ label: "BODY_PRIVATE_MARKER\nforged log", amount: "9876.54" }),
    "POST",
    "/operations/:id",
    201
  );
  await check(
    supertest(app).get("/failure/987654321"),
    "GET",
    "/failure/:id",
    500
  );
  await check(
    supertest(app).get(
      "/unknown/RESET_SECRET_MARKER?email=only-private%40example.invalid&line=%0AQUERY_PRIVATE_MARKER"
    ),
    "GET",
    "unmatched",
    404
  );
  await check(
    supertest(app).get(
      "/unknown/%52%45%53%45%54%5F%53%45%43%52%45%54%5F%4D%41%52%4B%45%52"
    ),
    "GET",
    "unmatched",
    404
  );
  await check(supertest(app).propfind("/method"), "OTHER", "/method", 204);
  await check(
    supertest(app).get("/alternative/987654321"),
    "GET",
    "unmatched",
    204
  );
  await check(
    supertest(app).get("/pattern/RESET_SECRET_MARKER"),
    "GET",
    "unmatched",
    204
  );
}

async function realServer(mode) {
  Object.assign(process.env, {
    NODE_ENV: mode,
    APP_BASE_URL: "/v1",
    ACCESS_TOKEN: "test-access-token-secret-at-least-32-characters",
    REFRESH_TOKEN: "test-refresh-token-secret-at-least-32-characters",
    REGISTER_TOKEN: "test-register-token-secret-at-least-32-characters",
    MAILER_DRIVER: "smtp",
    EMAIL_SENDER: "no-reply@myhappywallet.local",
  });
  // No connection is opened. The two invalid credentials fail before SQL;
  // startup/connectRateLimitStore and real health checks are not exercised.
  delete process.env.REDIS_URL;
  delete process.env.DATABASE_URL;
  const { createServer } = require("../../../src/server");
  const app = await createServer({
    checkDatabase: async () => undefined,
    apiDocsEnabled: false,
  });
  // Preserve the logger's position after health routes and request parsing.
  await supertest(app).get("/health/live").expect(200);
  await supertest(app)
    .post("/v1/users/authenticate")
    .set("Content-Type", "application/json")
    .send('{"invalid":')
    .expect(400);
  const urls = [
    "/v1/",
    "/v1/users/reset-password/RESET_SECRET_MARKER?email=only-private%40example.invalid",
    "/v1/users/verify/TENANT_PRIVATE_MARKER/CONFIRM_SECRET_MARKER",
    "/unknown/RESET_SECRET_MARKER?token=QUERY_PRIVATE_MARKER",
  ];
  const statuses = [];
  for (const url of urls) {
    const response = await supertest(app).get(url);
    statuses.push(response.status);
  }
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(statuses, [200, 401, 401, 404]);
  process.stdout.write(`SERVER_RESULT ${JSON.stringify(statuses)}\n`);
}

async function run() {
  await middlewarePrivacy();
  const routes = [
    "/",
    "/reset-password/:token",
    "/verify/:id/:token",
    "unmatched",
  ];
  const statuses = [200, 401, 401, 404];
  for (const mode of ["development", "test", "production"]) {
    const result = spawnSync(
      process.execPath,
      [__filename, "--server-mode", mode],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
        env: process.env,
      }
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, `Real server ${mode}: ${result.stderr}`);
    assertPrivate(result.stdout);
    assertPrivate(result.stderr);
    const lines = result.stdout.trim().split("\n");
    assert.equal(lines.pop(), "SERVER_RESULT [200,401,401,404]");
    assert.equal(lines.length, mode === "development" ? 4 : 0);
    lines.forEach((line, index) =>
      assertRecord(`${line}\n`, "GET", routes[index], statuses[index])
    );
  }
  console.log("Request logging privacy tests passed");
}

(process.argv[2] === "--server-mode"
  ? realServer(process.argv[3])
  : run()
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
