import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const email = "monthly-event-migration@example.test";
const migration = "20260918150000_expand_monthly_events";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Monthly event migration tests require the disposable test database."
  );
}
if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();
const cleanup = async () => prisma.utilisateur.deleteMany({ where: { email } });

const prepare = async () => {
  await cleanup();
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Legacy",
      lastname: "Event",
      email,
      password: "not-a-real-password",
    },
  });
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `EvenementMensuel` DROP FOREIGN KEY `EvenementMensuel_userId_fkey`"
  );
  await prisma.$executeRawUnsafe(
    "DROP INDEX `EvenementMensuel_userId_startDate_id_idx` ON `EvenementMensuel`"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `EvenementMensuel` ADD CONSTRAINT `EvenementMensuel_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `EvenementMensuel` DROP COLUMN `kind`, DROP COLUMN `startDate`, DROP COLUMN `recurrence`, DROP COLUMN `endDate`"
  );
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` = ?",
    migration
  );
  await prisma.$executeRawUnsafe(
    "INSERT INTO `EvenementMensuel` (`titre`, `montant`, `devise`, `userId`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?)",
    "Événement historique",
    "42.50",
    "EUR",
    user.id,
    new Date("2026-09-10T12:00:00.000Z"),
    new Date("2026-09-10T12:00:00.000Z")
  );
};

const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  const event = await prisma.evenementMensuel.findFirstOrThrow({
    where: { userId: user.id },
  });
  assert.strictEqual(event.title, "Événement historique");
  assert.strictEqual(event.kind, "DEPENSE");
  assert.strictEqual(event.recurrence, "AUCUNE");
  assert.strictEqual(event.startDate.toISOString().slice(0, 10), "2026-09-10");
  assert.strictEqual(event.endDate, null);
  await prisma.$executeRawUnsafe(
    "INSERT INTO `EvenementMensuel` (`titre`, `montant`, `devise`, `userId`, `created_at`, `updated_at`) VALUES (?, ?, ?, ?, ?, ?)",
    "Écriture ancien backend",
    "10.00",
    "EUR",
    user.id,
    new Date("2026-09-11T12:00:00.000Z"),
    new Date("2026-09-11T12:00:00.000Z")
  );
  const compatible = await prisma.evenementMensuel.findFirstOrThrow({
    where: { userId: user.id, title: "Écriture ancien backend" },
  });
  assert.ok(compatible.startDate instanceof Date);
  await prisma.utilisateur.delete({ where: { id: user.id } });
  assert.strictEqual(
    await prisma.evenementMensuel.count({ where: { userId: user.id } }),
    0
  );
};

(phase === "prepare" ? prepare : verify)()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    throw error;
  });
