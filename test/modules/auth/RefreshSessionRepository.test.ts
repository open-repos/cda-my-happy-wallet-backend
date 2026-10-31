import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaRefreshSessionRepository } from "../../../src/modules/auth/refreshSession/PrismaRefreshSessionRepository";
import { RefreshSessionService } from "../../../src/modules/auth/refreshSession/RefreshSessionService";

const databaseUrl = process.env.DATABASE_URL || "";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Refresh-session tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();

async function runRefreshSessionRepositoryTests() {
  await prisma.refreshSession.deleteMany();
  await prisma.utilisateur.deleteMany({
    where: { email: "refresh-session-test@example.com" },
  });

  const user = await prisma.utilisateur.create({
    data: {
      email: "refresh-session-test@example.com",
      password: "hashed-password",
      firstname: "Refresh",
      lastname: "Session",
      verified: true,
    },
  });
  const repository = new PrismaRefreshSessionRepository(prisma);
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const firstHash = "a".repeat(64);
  const secondHash = "b".repeat(64);
  const thirdHash = "c".repeat(64);

  await repository.create({
    id: sessionId,
    userId: user.id,
    tokenHash: firstHash,
    expiresAt: new Date(Date.now() + 60_000),
  });

  assert.strictEqual(
    await repository.rotate({
      id: sessionId,
      userId: user.id,
      currentTokenHash: firstHash,
      nextTokenHash: secondHash,
      nextExpiresAt: new Date(Date.now() + 120_000),
    }),
    true
  );
  assert.strictEqual(
    await repository.rotate({
      id: sessionId,
      userId: user.id,
      currentTokenHash: firstHash,
      nextTokenHash: thirdHash,
      nextExpiresAt: new Date(Date.now() + 120_000),
    }),
    false
  );

  await repository.revoke(sessionId, user.id);
  assert.strictEqual(
    await repository.rotate({
      id: sessionId,
      userId: user.id,
      currentTokenHash: secondHash,
      nextTokenHash: thirdHash,
      nextExpiresAt: new Date(Date.now() + 120_000),
    }),
    false
  );

  const expiredSessionId = "22222222-2222-4222-8222-222222222222";
  await repository.create({
    id: expiredSessionId,
    userId: user.id,
    tokenHash: "d".repeat(64),
    expiresAt: new Date(Date.now() - 60_000),
  });
  assert.strictEqual(
    await repository.rotate({
      id: expiredSessionId,
      userId: user.id,
      currentTokenHash: "d".repeat(64),
      nextTokenHash: "e".repeat(64),
      nextExpiresAt: new Date(Date.now() + 120_000),
    }),
    false
  );

  const stored = await prisma.refreshSession.findUnique({
    where: { id: sessionId },
  });
  assert.strictEqual(
    (await repository.findCreatedAt(sessionId, user.id))?.getTime(),
    stored?.createdAt.getTime()
  );
  assert.strictEqual(await repository.findCreatedAt(sessionId, user.id + 1), null);
  assert.strictEqual(
    await repository.findCreatedAt("33333333-3333-4333-8333-333333333333", user.id),
    null
  );

  const service = new RefreshSessionService(repository);
  const dayMs = 24 * 60 * 60 * 1000;
  const sessionOf = async (token: string) => {
    const session = await prisma.refreshSession.findUnique({
      where: { id: service.verify(token).sessionId },
    });
    assert.ok(session);
    return session;
  };

  // Issued through the real clock and the database default for createdAt.
  const fresh = await service.issue(user.id);
  const freshRow = await sessionOf(fresh);
  assert.ok(Math.abs(freshRow.createdAt.getTime() - Date.now()) < 60_000);
  assert.ok(
    Math.abs(freshRow.expiresAt.getTime() - (Date.now() + 7 * dayMs)) < 60_000
  );

  const nearLimit = await service.issue(user.id);
  const createdAt = new Date(Date.now() - 29 * dayMs);
  await prisma.refreshSession.update({
    where: { id: service.verify(nearLimit).sessionId },
    data: { createdAt },
  });
  const capped = await service.rotate(nearLimit);
  assert.ok(capped.refreshTokenExpiresIn <= dayMs / 1000);
  const cappedRow = await sessionOf(capped.refreshToken);
  assert.ok(cappedRow.expiresAt.getTime() <= createdAt.getTime() + 30 * dayMs);
  assert.ok(cappedRow.expiresAt.getTime() > Date.now());
  assert.strictEqual(cappedRow.revokedAt, null);

  // An existing active session already past the limit ends at its next renewal.
  const pastLimit = await service.issue(user.id);
  await prisma.refreshSession.update({
    where: { id: service.verify(pastLimit).sessionId },
    data: { createdAt: new Date(Date.now() - 31 * dayMs) },
  });
  await assert.rejects(() => service.rotate(pastLimit));
  assert.ok((await sessionOf(pastLimit)).revokedAt);

  // Two simultaneous renewals presenting the same token (two browser tabs
  // sharing one cookie): the replay protection revokes the whole session.
  const shared = await service.issue(user.id);
  const results = await Promise.allSettled([
    service.rotate(shared),
    service.rotate(shared),
  ]);
  const winners = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : []
  );
  assert.strictEqual(winners.length, 1);
  assert.ok((await sessionOf(shared)).revokedAt);
  await assert.rejects(() => service.rotate(winners[0].refreshToken));
}

runRefreshSessionRepositoryTests()
  .finally(async () => {
    await prisma.refreshSession.deleteMany();
    await prisma.utilisateur.deleteMany({
      where: { email: "refresh-session-test@example.com" },
    });
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
