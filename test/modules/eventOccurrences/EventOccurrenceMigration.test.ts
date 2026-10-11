import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const email = "occurrence-migration@example.test";
const migration = "20261011120000_add_event_occurrence_resolutions";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Event occurrence migration tests require the disposable test database."
  );
}
if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();

const prepare = async () => {
  await prisma.$executeRawUnsafe("DROP TABLE `EventOccurrenceResolution`");
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` = ?",
    migration
  );
};

const verify = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Migration",
      lastname: "Occurrence",
      email,
      password: "not-a-real-password",
    },
  });
  const snapshot = {
    userId: user.id,
    sourceEventId: 404,
    occurrenceDate: new Date("2026-10-05T00:00:00.000Z"),
    title: "Règle supprimée",
    amount: "10.00",
    currency: "EUR",
    kind: "DEPENSE" as const,
  };
  // La référence à la règle est historique : aucune clé étrangère ne l'impose.
  const created = await prisma.eventOccurrenceResolution.create({
    data: { ...snapshot, status: "CANCELED" },
  });
  assert.strictEqual(created.operationId, null);
  await assert.rejects(() =>
    prisma.eventOccurrenceResolution.create({
      data: { ...snapshot, status: "REALIZED" },
    })
  );
  await prisma.utilisateur.delete({ where: { id: user.id } });
  assert.strictEqual(
    await prisma.eventOccurrenceResolution.count({
      where: { userId: user.id },
    }),
    0
  );
};

(phase === "prepare" ? prepare : verify)()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    throw error;
  });
