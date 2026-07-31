import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { OperationFixeRepo } from "../../../src/modules/operationsFixes/operationFixeRepo";
import { UserRepo } from "../../../src/modules/user/userRepo";
import { FakeMailer } from "../../fakes/FakeMailer";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const databaseUrl = process.env.DATABASE_URL || "";

if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Repository data-access tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();

async function cleanDatabase() {
  await prisma.resteAVivre.deleteMany();
  await prisma.operationFixe.deleteMany();
  await prisma.utilisateur.deleteMany();
}

async function runRepositoryDataAccessTests() {
  await cleanDatabase();

  const userRepo = new UserRepo(prisma, new FakeMailer());
  const operationFixeRepo = new OperationFixeRepo(prisma);

  const user = await userRepo.create({
    email: "repository-test@example.com",
    password: "hashed-password",
    firstname: "Repository",
    lastname: "Test",
    confirmpassword: "hashed-password",
  });

  assert.strictEqual(user.email, "repository-test@example.com");

  const userExists = await userRepo.exists("repository-test@example.com");
  assert.strictEqual(userExists, true);

  const createdCharge = await operationFixeRepo.create(
    {
      titre: "Loyer",
      montant: 600,
      devise: "EUR",
    },
    String(user.id),
    "CHARGE"
  );

  assert.strictEqual(createdCharge.titre, "Loyer");
  assert.strictEqual(String(createdCharge.montant), "600");

  const operationExists = await operationFixeRepo.exists(
    createdCharge.idOperationFixe,
    user.id
  );
  assert.strictEqual(operationExists, true);

  const userOperations = await operationFixeRepo.getAllOperationsFixes(
    String(user.id)
  );

  assert.strictEqual(userOperations.length, 1);
  assert.strictEqual(userOperations[0].titre, "Loyer");
  assert.strictEqual(userOperations[0].typeOperation, "CHARGE");

  const resetToken = "c".repeat(128);
  await prisma.utilisateur.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiration: new Date(Date.now() + 60_000),
    },
  });

  assert.strictEqual(await userRepo.hasValidResetToken(resetToken), true);
  const passwordUpdate = await userRepo.newPassword(
    "new-hashed-password",
    resetToken
  );
  assert.strictEqual(passwordUpdate.count, 1);
  assert.strictEqual(await userRepo.hasValidResetToken(resetToken), false);
  await assert.rejects(
    () => userRepo.newPassword("second-password", resetToken),
    (error: ErrorException) => error.name === ErrorCode.Unauthorized
  );

  const expiredResetToken = "d".repeat(128);
  await prisma.utilisateur.update({
    where: { id: user.id },
    data: {
      resetToken: expiredResetToken,
      resetTokenExpiration: new Date(Date.now() - 60_000),
    },
  });

  assert.strictEqual(await userRepo.hasValidResetToken(expiredResetToken), false);
  await assert.rejects(
    () => userRepo.newPassword("expired-password", expiredResetToken),
    (error: ErrorException) => error.name === ErrorCode.Unauthorized
  );
}

runRepositoryDataAccessTests()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
