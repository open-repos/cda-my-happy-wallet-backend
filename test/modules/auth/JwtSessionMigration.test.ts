import assert from "assert";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaRefreshSessionRepository } from "../../../src/modules/auth/refreshSession/PrismaRefreshSessionRepository";
import { RefreshSessionService } from "../../../src/modules/auth/refreshSession/RefreshSessionService";

const migration = "20261017210000_revoke_pre_issuer_audience_sessions";
const phase = process.argv[2];
let disposable = false;
try {
  const url = new URL(process.env.DATABASE_URL || "");
  disposable =
    process.env.NODE_ENV === "test" &&
    url.protocol === "mysql:" &&
    url.hostname === "my-happy-wallet-mysql-test" &&
    url.pathname === "/myhappywallet_test";
} catch {
  /* Fail closed before opening a client. */
}
if (!disposable)
  throw new Error(
    "JWT session migration tests require the guarded disposable test database."
  );
if (phase !== "prepare" && phase !== "verify")
  throw new Error("Expected migration phase: prepare or verify.");

const prisma = new PrismaClient();
const emails = ["jwt-cutover-a@example.test", "jwt-cutover-b@example.test"];
const originalDate = new Date("2026-01-01T00:00:00.000Z");
const futureDate = new Date("2099-01-01T00:00:00.000Z");
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const definitions = [
  { id: "11111111-1111-4111-8111-111111111135", owner: 0, state: "active" },
  { id: "22222222-2222-4222-8222-222222222235", owner: 1, state: "active" },
  { id: "33333333-3333-4333-8333-333333333335", owner: 0, state: "revoked" },
  { id: "44444444-4444-4444-8444-444444444435", owner: 1, state: "expired" },
];

async function prepare() {
  await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
  const owners = [];
  for (const email of emails)
    owners.push(
      await prisma.utilisateur.create({
        data: {
          email,
          firstname: "JWT",
          lastname: "Cutover",
          password: "not-a-real-password",
          verified: true,
        },
      })
    );
  for (const definition of definitions)
    await prisma.refreshSession.create({
      data: {
        id: definition.id,
        userId: owners[definition.owner].id,
        tokenHash: digest(definition.id),
        expiresAt: definition.state === "expired" ? originalDate : futureDate,
        revokedAt: definition.state === "revoked" ? originalDate : null,
        createdAt: originalDate,
        updatedAt: originalDate,
      },
    });
  // Rehearse only this immutable data migration, on a disposable schema.
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` = ?",
    migration
  );
}

async function verify() {
  const owners = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
    orderBy: { email: "asc" },
  });
  assert.equal(owners.length, 2);
  for (const owner of owners) {
    assert.equal(owner.password, "not-a-real-password");
    assert.equal(owner.verified, true);
  }
  const rows = await prisma.refreshSession.findMany({
    where: { userId: { in: owners.map((user) => user.id) } },
    orderBy: { id: "asc" },
  });
  assert.equal(rows.length, 4);
  for (const definition of definitions) {
    const row = rows.find((session) => session.id === definition.id);
    assert.ok(row);
    assert.equal(row.userId, owners[definition.owner].id);
    assert.equal(row.tokenHash, digest(definition.id));
    assert.equal(row.createdAt.toISOString(), originalDate.toISOString());
    assert.equal(
      row.expiresAt.toISOString(),
      (definition.state === "expired" ? originalDate : futureDate).toISOString()
    );
    assert.ok(row.revokedAt);
    if (definition.state === "revoked")
      assert.equal(row.revokedAt.toISOString(), originalDate.toISOString());
  }
  const sql = fs.readFileSync(
    path.resolve(
      __dirname,
      `../../../src/database/migrations/${migration}/migration.sql`
    ),
    "utf8"
  );
  await prisma.$executeRawUnsafe(sql);
  const repeated = await prisma.refreshSession.findMany({
    where: { userId: { in: owners.map((user) => user.id) } },
    orderBy: { id: "asc" },
  });
  assert.deepStrictEqual(
    repeated,
    rows,
    "Repeating the cutover must not rewrite revoked sessions"
  );
  const repository = new PrismaRefreshSessionRepository(prisma);
  for (const row of rows)
    assert.equal(
      await repository.rotate({
        id: row.id,
        userId: row.userId,
        currentTokenHash: row.tokenHash,
        nextTokenHash: digest(`next:${row.id}`),
        nextExpiresAt: futureDate,
      }),
      false
    );
  const service = new RefreshSessionService(repository);
  const fresh = await service.issue(owners[0].id);
  const rotated = await service.rotate(fresh);
  assert.equal(rotated.userId, owners[0].id);
  assert.equal(service.verify(rotated.refreshToken).id, owners[0].id);
  assert.notEqual(rotated.refreshToken, fresh);
  console.log("JWT session cutover migration tests passed");
}

(phase === "prepare" ? prepare() : verify())
  .finally(async () => {
    if (phase === "verify")
      await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
