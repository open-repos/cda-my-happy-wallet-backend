import assert from "assert";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL || "";
const phase = process.argv[2];
const fixtureEmail = "operation-migration@example.test";
const fixtureCategory = "Migration test";
const migrationNames = [
  "20260809210000_expand_personal_operation_categories",
  "20260809211000_backfill_personal_operation_categories",
  "20260818190000_add_collection_pagination_indexes",
  "20260919110000_add_budget_periods",
];

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Operation migration tests require the disposable myhappywallet_test database."
  );
}

if (phase !== "prepare" && phase !== "verify") {
  throw new Error("Expected migration test phase: prepare or verify");
}

const prisma = new PrismaClient();

const cleanLegacyFixture = async () => {
  const users = await prisma.utilisateur.findMany({
    where: { email: fixtureEmail },
    select: { id: true },
  });

  for (const user of users) {
    const operations = await prisma.operation.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    const operationIds = operations.map((operation) => operation.id);
    if (operationIds.length > 0) {
      await prisma.periodique.deleteMany({
        where: { idPeriodique: { in: operationIds } },
      });
      await prisma.operation.deleteMany({
        where: { id: { in: operationIds } },
      });
    }
    await prisma.utilisateur.delete({ where: { id: user.id } });
  }

  await prisma.categorie.deleteMany({ where: { categorie: fixtureCategory } });
};

const prepare = async () => {
  await cleanLegacyFixture();

  const user = await prisma.utilisateur.create({
    data: {
      email: fixtureEmail,
      password: "hashed-password",
      firstname: "Migration",
      lastname: "Test",
    },
  });
  const category = await prisma.categorie.create({
    data: { categorie: fixtureCategory },
  });

  const oneOff = await prisma.operation.create({
    data: {
      titre: "Legacy ponctuelle",
      montant: "12.34",
      devise: "eur",
      dateOperation: new Date("2026-08-08T00:00:00.000Z"),
      type: "DEPENSE",
      User: { connect: { id: user.id } },
      Categorie: { connect: { id: category.id } },
    },
  });
  const periodic = await prisma.operation.create({
    data: {
      titre: "Legacy periodique",
      montant: "99.00",
      devise: "EUR",
      dateOperation: new Date("2026-08-01T00:00:00.000Z"),
      type: "DEPENSE",
      User: { connect: { id: user.id } },
      Categorie: { connect: { id: category.id } },
    },
  });
  await prisma.periodique.create({
    data: {
      idPeriodique: periodic.id,
      periode: "mois",
    },
  });

  assert.ok(oneOff.id > 0);
  await prisma.$executeRawUnsafe(
    "CREATE INDEX `OperationFixe_userId_migration_test_idx` ON `OperationFixe`(`userId`)"
  );
  await prisma.$executeRawUnsafe(
    "DROP INDEX `OperationFixe_userId_idOperationFixe_idx` ON `OperationFixe`"
  );
  await prisma.$executeRawUnsafe(
    "DROP INDEX `OperationFixe_userId_typeOperation_idOperationFixe_idx` ON `OperationFixe`"
  );
  await prisma.$executeRawUnsafe("DROP TABLE `BudgetPeriod`");
  await prisma.$executeRawUnsafe("DROP TABLE `OneOffOperationRecord`");
  await prisma.$executeRawUnsafe("DROP TABLE `OperationCategory`");
  await prisma.$executeRawUnsafe("DROP TABLE `OperationCategoryTemplate`");
  await prisma.$executeRawUnsafe(
    `DELETE FROM \`_prisma_migrations\` WHERE \`migration_name\` IN (?, ?, ?, ?)`,
    ...migrationNames
  );
};

const verify = async () => {
  const user = await prisma.utilisateur.findUniqueOrThrow({
    where: { email: fixtureEmail },
  });
  const legacyOperations = await prisma.operation.findMany({
    where: { userId: user.id },
    orderBy: { id: "asc" },
  });
  const copiedOperations = await prisma.oneOffOperationRecord.findMany({
    where: { userId: user.id },
  });
  const categories = await prisma.operationCategory.findMany({
    where: { userId: user.id },
  });

  assert.strictEqual(await prisma.operationCategoryTemplate.count(), 4);
  assert.strictEqual(legacyOperations.length, 2);
  assert.strictEqual(copiedOperations.length, 1);
  assert.strictEqual(copiedOperations[0].title, "Legacy ponctuelle");
  assert.strictEqual(copiedOperations[0].currency, "EUR");
  assert.strictEqual(
    copiedOperations[0].legacyOperationId,
    legacyOperations[0].id
  );
  assert.ok(categories.some((category) => category.name === fixtureCategory));
  assert.ok(categories.length >= 5);

  await prisma.$executeRawUnsafe(
    "DROP INDEX `OperationFixe_userId_migration_test_idx` ON `OperationFixe`"
  );

  await prisma.oneOffOperationRecord.deleteMany({ where: { userId: user.id } });
  await prisma.operationCategory.deleteMany({ where: { userId: user.id } });
  await cleanLegacyFixture();
};

const run = phase === "prepare" ? prepare : verify;

run()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
