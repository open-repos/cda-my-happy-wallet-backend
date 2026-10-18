import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { EventOccurrenceUseCases } from "../../../src/modules/eventOccurrences/application";
import { PrismaOccurrenceResolutionRepository } from "../../../src/modules/eventOccurrences/infrastructure";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";
import { PrismaOperationCategoryRepository } from "../../../src/modules/operations/infrastructure";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error("Bounded scan tests require the disposable test database.");
}

const prisma = new PrismaClient();
const email = "budget-bounded-scan@example.test";
const TODAY = "2026-10-11";

const cleanDatabase = async () => {
  const users = await prisma.utilisateur.findMany({
    where: { email },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  await prisma.eventOccurrenceResolution.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.oneOffOperationRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationCategory.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.utilisateur.deleteMany({ where: { id: { in: userIds } } });
};

const planOf = async (sql: string, ...values: unknown[]) =>
  JSON.stringify(
    await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `EXPLAIN FORMAT=JSON ${sql}`,
      ...values
    )
  );

const run = async () => {
  await cleanDatabase();
  const user = await prisma.utilisateur.create({
    data: {
      firstname: "Bounded",
      lastname: "Scan",
      email,
      password: "not-a-real-password",
    },
  });
  const category = await prisma.operationCategory.create({
    data: { name: "Bounded scan", userId: user.id },
  });

  // 25 mois d'historique, 20 opérations par mois, deux devises.
  const operations = [];
  for (let offset = 0; offset < 25; offset += 1) {
    const monthIndex = 2024 * 12 + offset;
    const month = `${Math.floor(monthIndex / 12)}-${String(
      (monthIndex % 12) + 1
    ).padStart(2, "0")}`;
    for (let day = 1; day <= 20; day += 1) {
      operations.push({
        title: `Op ${month}-${day}`,
        amount: "1.01",
        currency: day % 5 === 0 ? "USD" : "EUR",
        type: "DEPENSE" as const,
        operationDate: new Date(
          `${month}-${String(day).padStart(2, "0")}T00:00:00.000Z`
        ),
        userId: user.id,
        categoryId: category.id,
      });
    }
  }
  await prisma.oneOffOperationRecord.createMany({ data: operations });
  const events = await Promise.all(
    Array.from({ length: 40 }, (_, index) =>
      prisma.evenementMensuel.create({
        data: {
          title: `Règle ${index}`,
          amount: "2.00",
          currency: "EUR",
          startDate: new Date(
            `2024-0${(index % 9) + 1}-${String((index % 28) + 1).padStart(
              2,
              "0"
            )}T00:00:00.000Z`
          ),
          recurrence: "MENSUELLE",
          userId: user.id,
        },
      })
    )
  );

  const periods = new PrismaBudgetPeriodRepository(prisma);
  const engine = new BudgetPeriodEngine(periods);
  const summary = await engine.summarize(
    user.id,
    "2026-01",
    "EUR",
    "2026-01-15"
  );
  // Seules les 16 opérations EUR de janvier 2026 sont lues.
  assert.strictEqual(summary.budget.actualExpenseMinorUnits, 16 * 101);
  assert.strictEqual(summary.budget.days.length, 31);
  assert.ok(summary.forecast != null);
  // Chaque règle produit au plus une occurrence dans le mois.
  assert.strictEqual(summary.forecast.unresolvedCount, 40);
  assert.ok(
    (await periods.plannedMovements(user.id, "2026-01", "EUR")).length <= 62
  );

  // Concurrence : annulations simultanées idempotentes, une seule décision.
  const useCases = new EventOccurrenceUseCases(
    new PrismaMonthlyEventRepository(prisma),
    new PrismaOperationCategoryRepository(prisma),
    periods,
    new PrismaOccurrenceResolutionRepository(prisma),
    () => TODAY
  );
  const target = events[0];
  const date = `2026-10-${String(target.startDate.getUTCDate()).padStart(
    2,
    "0"
  )}`;
  const cancellations = await Promise.all([
    useCases.cancel(user.id, target.id, date),
    useCases.cancel(user.id, target.id, date),
    useCases.cancel(user.id, target.id, date),
  ]);
  assert.strictEqual(
    cancellations.filter((result) => !result.replayed).length,
    1
  );
  assert.strictEqual(
    await prisma.eventOccurrenceResolution.count({
      where: { userId: user.id },
    }),
    1
  );

  // Clôture : le bilan figé ne bouge plus après lecture répétée.
  const closed = await engine.summarize(user.id, "2025-12", "EUR", TODAY);
  const again = await engine.summarize(user.id, "2025-12", "EUR", TODAY);
  assert.strictEqual(closed.period.status, "CLOSED");
  assert.strictEqual(again.period.revision, closed.period.revision);
  assert.strictEqual(
    again.period.realRemainingMinorUnits,
    closed.period.realRemainingMinorUnits
  );
  assert.strictEqual(closed.period.unresolvedEvents, 40);

  // Plans SQL : chaque lecture mensuelle est bornée par un index propriétaire.
  assert.ok(
    (
      await planOf(
        "SELECT `amount`, `type`, `operationDate` FROM `OneOffOperationRecord` WHERE `userId` = ? AND `currency` = ? AND `operationDate` BETWEEN ? AND ? ORDER BY `operationDate`, `id`",
        user.id,
        "EUR",
        new Date("2026-01-01T00:00:00.000Z"),
        new Date("2026-01-31T00:00:00.000Z")
      )
    ).includes("OneOffOperationRecord_userId_currency_operationDate_id_idx")
  );
  assert.ok(
    (
      await planOf(
        "SELECT `id` FROM `EvenementMensuel` WHERE `userId` = ? AND `startDate` <= ?",
        user.id,
        new Date("2026-01-31T00:00:00.000Z")
      )
    ).includes("EvenementMensuel_userId_startDate_id_idx")
  );
  assert.ok(
    (
      await planOf(
        "SELECT `id` FROM `EventOccurrenceResolution` WHERE `userId` = ? AND `sourceEventId` = ? AND `occurrenceDate` = ?",
        user.id,
        target.id,
        new Date(`${date}T00:00:00.000Z`)
      )
    ).includes(
      "EventOccurrenceResolution_userId_sourceEventId_occurrenceDat_key"
    )
  );
  assert.ok(
    (
      await planOf(
        "SELECT `id` FROM `BudgetPeriod` WHERE `userId` = ? AND `currency` = ? AND `status` = 'CLOSED' ORDER BY `periodStart` DESC, `id` DESC LIMIT 51",
        user.id,
        "EUR"
      )
    ).includes("BudgetPeriod_userId_currency_periodStart_id_idx")
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
