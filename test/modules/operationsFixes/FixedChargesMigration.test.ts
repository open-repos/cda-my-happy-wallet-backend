import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Fixed charge migration tests require the disposable myhappywallet_test database."
  );
}
const prisma = new PrismaClient();
const email = "fixed-charge-migration@example.test";
const migrationName = "20261022070000_add_fixed_charge_periodicity_share";
async function clean() {
  const users = await prisma.utilisateur.findMany({
    where: { email },
    select: { id: true },
  });
  for (const user of users) {
    await prisma.operationFixe.deleteMany({ where: { userId: user.id } });
    await prisma.utilisateur.delete({ where: { id: user.id } });
  }
}
async function run() {
  const phase = process.argv[2];
  if (phase === "prepare") {
    await clean();
    // Reconstruct only the old columns in the guarded disposable database;
    // production migrations themselves only ADD columns.
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `OperationFixe` DROP COLUMN `periodicite`, DROP COLUMN `pourcentagePersonnel`"
    );
    await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = ${migrationName}`;
    const user = await prisma.utilisateur.create({
      data: {
        email,
        firstname: "Migration",
        lastname: "Test",
        password: "not-a-real-password",
      },
    });
    await prisma.$executeRaw`INSERT INTO OperationFixe (titre, montant, devise, typeOperation, userId) VALUES ('Ancienne charge', 123.45, 'EUR', 'CHARGE', ${user.id})`;
  } else if (phase === "verify") {
    const row = await prisma.operationFixe.findFirstOrThrow({
      where: { User: { email } },
    });
    assert.strictEqual(row.montant.toFixed(2), "123.45");
    assert.strictEqual(row.periodicite, "MENSUELLE");
    assert.strictEqual(row.pourcentagePersonnel.toFixed(2), "100.00");
    await clean();
    console.log(
      "Fixed charge additive migration preserved legacy amounts and defaults"
    );
  } else throw new Error("Expected prepare or verify");
}
run()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
