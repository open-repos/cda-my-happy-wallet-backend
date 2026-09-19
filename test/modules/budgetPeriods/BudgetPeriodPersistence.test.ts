import assert from "assert";
import {
  PrismaClient,
  TypeOperationEnum,
  TypeOperationFixeEnum,
} from "@prisma/client";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Budget period persistence tests require the disposable test database."
  );
}

const prisma = new PrismaClient();
const email = "budget-period-owner@example.test";

const cleanDatabase = async () => {
  const users = await prisma.utilisateur.findMany({
    where: { email },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  await prisma.oneOffOperationRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationCategory.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationFixe.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.utilisateur.deleteMany({ where: { id: { in: userIds } } });
};

const run = async () => {
  await cleanDatabase();
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Budget",
      lastname: "Owner",
      email,
      password: "not-a-real-password",
    },
  });
  const category = await prisma.operationCategory.create({
    data: { name: "Budget period test", userId: user.id },
  });
  await prisma.operationFixe.createMany({
    data: [
      {
        titre: "Salaire",
        montant: "2364.00",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.REVENU,
        userId: user.id,
      },
      {
        titre: "Charges",
        montant: "1500.40",
        devise: "EUR",
        typeOperation: TypeOperationFixeEnum.CHARGE,
        userId: user.id,
      },
    ],
  });
  await prisma.oneOffOperationRecord.createMany({
    data: [
      {
        title: "Courses",
        amount: "20.50",
        currency: "EUR",
        type: TypeOperationEnum.DEPENSE,
        operationDate: new Date("2026-09-02T00:00:00.000Z"),
        userId: user.id,
        categoryId: category.id,
      },
      {
        title: "Remboursement",
        amount: "5.00",
        currency: "EUR",
        type: TypeOperationEnum.ENTREE,
        operationDate: new Date("2026-09-02T00:00:00.000Z"),
        userId: user.id,
        categoryId: category.id,
      },
      {
        title: "Ancienne dépense",
        amount: "12.00",
        currency: "EUR",
        type: TypeOperationEnum.DEPENSE,
        operationDate: new Date("2026-08-12T00:00:00.000Z"),
        userId: user.id,
        categoryId: category.id,
      },
    ],
  });

  const engine = new BudgetPeriodEngine(
    new PrismaBudgetPeriodRepository(prisma)
  );
  const current = await engine.summarize(
    user.id,
    "2026-09",
    "eur",
    "2026-09-19"
  );
  assert.strictEqual(current.period.status, "OPEN");
  assert.strictEqual(current.budget.baseMinorUnits, 86360);
  assert.strictEqual(current.budget.realRemainingMinorUnits, 84810);
  assert.strictEqual(current.budget.days.length, 30);
  const plan = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
    "EXPLAIN FORMAT=JSON SELECT `id`, `amount`, `type`, `operationDate` FROM `OneOffOperationRecord` WHERE `userId` = ? AND `currency` = ? AND `operationDate` BETWEEN ? AND ? ORDER BY `operationDate` ASC, `id` ASC",
    user.id,
    "EUR",
    new Date("2026-09-01T00:00:00.000Z"),
    new Date("2026-09-30T00:00:00.000Z")
  );
  assert.ok(
    Object.values(plan[0] ?? {}).some((value) =>
      value.includes(
        "OneOffOperationRecord_userId_currency_operationDate_id_idx"
      )
    )
  );

  await prisma.operationFixe.updateMany({
    where: {
      userId: user.id,
      typeOperation: TypeOperationFixeEnum.CHARGE,
    },
    data: { montant: "1400.40" },
  });
  const refreshed = await engine.summarize(
    user.id,
    "2026-09",
    "EUR",
    "2026-09-19"
  );
  assert.strictEqual(refreshed.period.revision, 2);
  assert.strictEqual(refreshed.budget.baseMinorUnits, 96360);

  const past = await engine.summarize(user.id, "2026-08", "EUR", "2026-09-19");
  assert.strictEqual(past.period.status, "CLOSED");
  assert.ok(past.period.closedAt instanceof Date);
  assert.strictEqual(past.budget.actualExpenseMinorUnits, 1200);

  await prisma.operationFixe.updateMany({
    where: {
      userId: user.id,
      typeOperation: TypeOperationFixeEnum.CHARGE,
    },
    data: { montant: "1000.00" },
  });
  const frozen = await engine.summarize(
    user.id,
    "2026-08",
    "EUR",
    "2026-09-19"
  );
  assert.strictEqual(
    frozen.period.fixedExpenseMinorUnits,
    past.period.fixedExpenseMinorUnits
  );
  assert.strictEqual(frozen.period.revision, past.period.revision);

  await prisma.oneOffOperationRecord.deleteMany({ where: { userId: user.id } });
  await prisma.operationCategory.deleteMany({ where: { userId: user.id } });
  await prisma.operationFixe.deleteMany({ where: { userId: user.id } });
  await prisma.utilisateur.delete({ where: { id: user.id } });
  assert.strictEqual(
    await prisma.budgetPeriod.count({ where: { userId: user.id } }),
    0
  );
};

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    throw error;
  });
