import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaRefreshSessionRepository } from "../../../src/modules/auth/refreshSession/PrismaRefreshSessionRepository";

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
