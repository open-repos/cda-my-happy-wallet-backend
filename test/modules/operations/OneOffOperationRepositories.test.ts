import assert from "assert";
import { PrismaClient } from "@prisma/client";
import {
  OneOffOperationUseCases,
  OperationApplicationError,
  OperationCategoryUseCases,
} from "../../../src/modules/operations/application";
import {
  PrismaOneOffOperationRepository,
  PrismaOperationCategoryRepository,
} from "../../../src/modules/operations/infrastructure";
import { UserRepo } from "../../../src/modules/user/userRepo";
import { FakeMailer } from "../../fakes/FakeMailer";

const firstPage = { limit: 50, cursor: null } as const;

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Operation repository tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();

const expectsApplicationError = (
  code: OperationApplicationError["code"]
) => (error: unknown): boolean =>
  error instanceof OperationApplicationError && error.code === code;

async function createUser(email: string) {
  return new UserRepo(prisma, new FakeMailer()).create({
    email,
    password: "hashed-password",
    firstname: "Repository",
    lastname: "Test",
    confirmpassword: "hashed-password",
  });
}

async function cleanDatabase() {
  await prisma.oneOffOperationRecord.deleteMany();
  await prisma.operationCategory.deleteMany();
  await prisma.utilisateur.deleteMany();
}

async function run() {
  await cleanDatabase();
  const firstUser = await createUser("repository-owner@example.test");
  const secondUser = await createUser("repository-other@example.test");
  const categoryRepository = new PrismaOperationCategoryRepository(prisma);
  const operationRepository = new PrismaOneOffOperationRepository(prisma);
  const categories = new OperationCategoryUseCases(categoryRepository);
  const operations = new OneOffOperationUseCases(
    operationRepository,
    categoryRepository
  );

  assert.strictEqual((await categories.list(firstUser.id, firstPage)).data.length, 4);
  const category = await categories.create(firstUser.id, {
    name: "Voyage",
    color: "#336699",
  });

  await assert.rejects(
    () => categories.create(firstUser.id, { name: "Voyage" }),
    expectsApplicationError("CATEGORY_NAME_CONFLICT")
  );

  const created = await operations.create(firstUser.id, {
    title: "Billet de train",
    amount: "78.40",
    currency: "eur",
    kind: "DEPENSE",
    operationDate: "2026-08-10",
    categoryId: category.id,
  });
  assert.ok(created.id != null);
  assert.strictEqual(created.money.minorUnits, 7840);
  assert.strictEqual(created.operationDate, "2026-08-10");

  await assert.rejects(
    () => operations.get(secondUser.id, created.id!),
    expectsApplicationError("OPERATION_NOT_FOUND")
  );
  await assert.rejects(
    () => categories.delete(firstUser.id, category.id),
    expectsApplicationError("CATEGORY_IN_USE")
  );

  const updated = await operations.update(firstUser.id, created.id!, {
    title: "Billet remboursé",
    amount: "78.40",
    currency: "EUR",
    kind: "ENTREE",
    operationDate: "2026-08-12",
    categoryId: category.id,
  });
  assert.strictEqual(updated.kind, "ENTREE");
  assert.strictEqual(updated.operationDate, "2026-08-12");

  await operations.delete(firstUser.id, created.id!);
  await categories.delete(firstUser.id, category.id);
  assert.strictEqual(await categoryRepository.findById(category.id, firstUser.id), null);
}

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
