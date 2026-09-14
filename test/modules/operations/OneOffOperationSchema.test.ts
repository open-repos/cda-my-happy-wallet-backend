import assert from "assert";
import { PrismaClient } from "@prisma/client";

import { UserRepo } from "../../../src/modules/user/userRepo";
import { FakeMailer } from "../../fakes/FakeMailer";

const databaseUrl = process.env.DATABASE_URL || "";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Operation schema tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();

const hasPrismaCode = (error: unknown, code: string): boolean => {
  return (
    typeof error === "object" &&
    error != null &&
    "code" in error &&
    (error as { code?: string }).code === code
  );
};

const createUser = async (email: string) => {
  return new UserRepo(prisma, new FakeMailer()).create({
    email,
    password: "hashed-password",
    firstname: "Schema",
    lastname: "Test",
    confirmpassword: "hashed-password",
  });
};

async function cleanDatabase() {
  await prisma.oneOffOperationRecord.deleteMany();
  await prisma.operationCategory.deleteMany();
  await prisma.utilisateur.deleteMany();
}

async function run() {
  await cleanDatabase();

  const templates = await prisma.operationCategoryTemplate.findMany({
    orderBy: { sortOrder: "asc" },
  });
  assert.deepStrictEqual(
    templates.map((template) => template.code),
    ["ALIMENTATION", "LOISIR", "IMPREVU", "AUTRES"]
  );

  const firstUser = await createUser("schema-owner@example.test");
  const secondUser = await createUser("schema-other@example.test");
  const firstCategories = await prisma.operationCategory.findMany({
    where: { userId: firstUser.id },
    orderBy: { name: "asc" },
  });

  assert.strictEqual(firstCategories.length, templates.length);
  assert.ok(firstCategories.every((category) => category.templateId != null));

  const category = await prisma.operationCategory.update({
    where: { id: firstCategories[0].id },
    data: { color: "#EA7C69", name: "Courses" },
  });
  assert.strictEqual(category.name, "Courses");
  assert.strictEqual(category.color, "#EA7C69");

  const operation = await prisma.oneOffOperationRecord.create({
    data: {
      title: "Courses semaine",
      amount: "42.50",
      currency: "EUR",
      type: "DEPENSE",
      operationDate: new Date("2026-08-09T00:00:00.000Z"),
      userId: firstUser.id,
      categoryId: category.id,
    },
  });

  assert.strictEqual(String(operation.amount), "42.5");

  await assert.rejects(
    () =>
      prisma.oneOffOperationRecord.create({
        data: {
          title: "Categorie etrangere",
          amount: "10.00",
          currency: "EUR",
          type: "DEPENSE",
          operationDate: new Date("2026-08-09T00:00:00.000Z"),
          userId: secondUser.id,
          categoryId: category.id,
        },
      }),
    (error: unknown) => hasPrismaCode(error, "P2003")
  );

  await assert.rejects(
    () => prisma.operationCategory.delete({ where: { id: category.id } }),
    (error: unknown) => hasPrismaCode(error, "P2003")
  );

  await prisma.oneOffOperationRecord.delete({ where: { id: operation.id } });
  await prisma.operationCategory.delete({ where: { id: category.id } });
}

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
