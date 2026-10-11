import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const email = "financial-goal-migration@example.test";
const migration = "20261011090000_expand_financial_goals";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Financial goal migration tests require the disposable test database."
  );
}
if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();
const insertLegacyGoal = (title: string, userId: number) =>
  prisma.$executeRawUnsafe(
    "INSERT INTO `ObjectifFinancier` (`titre`, `montant`, `devise`, `dateObjectifAtteint`, `userId`) VALUES (?, ?, ?, ?, ?)",
    title,
    "800.00",
    "EUR",
    new Date("2027-06-30T00:00:00.000Z"),
    userId
  );

const prepare = async () => {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Legacy",
      lastname: "Goal",
      email,
      password: "not-a-real-password",
    },
  });
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `ObjectifFinancier` DROP FOREIGN KEY `ObjectifFinancier_userId_fkey`"
  );
  await prisma.$executeRawUnsafe(
    "DROP INDEX `ObjectifFinancier_userId_id_idx` ON `ObjectifFinancier`"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `ObjectifFinancier` ADD CONSTRAINT `ObjectifFinancier_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Utilisateur`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE"
  );
  await prisma.$executeRawUnsafe(
    "ALTER TABLE `ObjectifFinancier` DROP COLUMN `savedAmount`, DROP COLUMN `monthlyContribution`"
  );
  await prisma.$executeRawUnsafe(
    "DELETE FROM `_prisma_migrations` WHERE `migration_name` = ?",
    migration
  );
  await insertLegacyGoal("Objectif historique", user.id);
};

const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({ where: { email } });
  const goal = await prisma.objectifFinancier.findFirstOrThrow({
    where: { userId: user.id },
  });
  assert.strictEqual(goal.title, "Objectif historique");
  assert.strictEqual(goal.targetAmount.toFixed(2), "800.00");
  assert.strictEqual(goal.savedAmount.toFixed(2), "0.00");
  assert.strictEqual(goal.monthlyContribution.toFixed(2), "0.00");
  assert.strictEqual(goal.targetDate?.toISOString().slice(0, 10), "2027-06-30");

  // L'ancien backend n'écrit pas les nouvelles colonnes : leurs défauts suffisent.
  await insertLegacyGoal("Écriture ancien backend", user.id);
  assert.strictEqual(
    await prisma.objectifFinancier.count({ where: { userId: user.id } }),
    2
  );
  await prisma.utilisateur.delete({ where: { id: user.id } });
  assert.strictEqual(
    await prisma.objectifFinancier.count({ where: { userId: user.id } }),
    0
  );
};

(phase === "prepare" ? prepare : verify)()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    throw error;
  });
