/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaSavingsRepository } from "../../../src/modules/savings/infrastructure/PrismaSavingsRepository";
import { PrismaCurrentAccount } from "../../../src/modules/savings/infrastructure/PrismaCurrentAccount";
import { PrismaFinancialGoalRepository } from "../../../src/modules/financialGoals/infrastructure/PrismaFinancialGoalRepository";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure/PrismaBudgetPeriodRepository";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { PrismaOperationAnalyticsRepository } from "../../../src/modules/analytics/infrastructure/PrismaOperationAnalyticsRepository";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import {
  SavingsError,
  balanceFromLedger,
  Transfer,
} from "../../../src/modules/savings/domain/Savings";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw new Error("Disposable test database required");
const prisma = new PrismaClient();
const emails = ["savings-owner@test.local", "savings-other@test.local"];
const page = { limit: 1, cursor: null };
async function run() {
  await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          email,
          firstname: "Savings",
          lastname: "Tests",
          password: "test-only",
          verified: true,
        },
      })
    )
  );
  let today = "2026-11-07";
  const repo = new PrismaSavingsRepository(prisma, () => today);
  const goals = new PrismaFinancialGoalRepository(prisma);
  const periods = new PrismaBudgetPeriodRepository(
    prisma,
    undefined,
    () => today
  );
  const forecast = new BudgetForecastService(periods);
  const reject = (work: () => Promise<unknown>, code: string) =>
    assert.rejects(
      work,
      (e: unknown) => e instanceof SavingsError && e.code === code
    );
  const transfer = (key: string, amount = 101): Transfer => ({
    direction: "TO_SAVINGS",
    amountMinorUnits: amount,
    operationDate: today,
    reason: "MANUAL",
    idempotencyKey: key,
  });
  try {
    const account = await repo.create(owner.id, {
      name: "Vacances",
      currency: "EUR",
      initialBalanceMinorUnits: 0,
    });
    const second = await repo.create(owner.id, {
      name: "Secours",
      currency: "EUR",
      initialBalanceMinorUnits: 200,
    });
    const privateAccount = await repo.create(other.id, {
      name: "Privé",
      currency: "EUR",
      initialBalanceMinorUnits: 1000,
    });
    await reject(() => repo.get(other.id, account.id), "NOT_FOUND");
    await reject(
      () => repo.update(other.id, account.id, { name: "Volé" }),
      "NOT_FOUND"
    );
    await reject(
      () => repo.transfer(other.id, account.id, transfer("foreign-transfer")),
      "NOT_FOUND"
    );
    await reject(() => repo.history(other.id, account.id, page), "NOT_FOUND");
    const withdrawals = await Promise.allSettled(
      ["withdraw-race-one", "withdraw-race-two"].map((key) =>
        repo.transfer(other.id, privateAccount.id, {
          ...transfer(key, 750),
          direction: "FROM_SAVINGS",
        })
      )
    );
    assert.equal(
      withdrawals.filter((row) => row.status === "fulfilled").length,
      1
    );
    assert.equal(
      (await repo.get(other.id, privateAccount.id)).balanceMinorUnits,
      250
    );
    for (const result of withdrawals)
      if (result.status === "rejected")
        assert.ok(
          result.reason instanceof SavingsError &&
            result.reason.code === "INSUFFICIENT_SAVINGS"
        );
    const caseOne = await repo.transfer(
      other.id,
      privateAccount.id,
      transfer("Case-sensitive-key", 1)
    );
    const caseTwo = await repo.transfer(
      other.id,
      privateAccount.id,
      transfer("case-sensitive-key", 2)
    );
    assert.notEqual(caseOne.id, caseTwo.id);
    assert.equal(
      (await repo.get(other.id, privateAccount.id)).balanceMinorUnits,
      253
    );
    const firstPage = await repo.list(owner.id, page);
    assert.equal(firstPage.data[0].id, account.id);
    assert.equal(
      (
        await repo.list(owner.id, {
          ...page,
          cursor: firstPage.meta.nextCursor,
        })
      ).data[0].id,
      second.id
    );
    await assert.rejects(() =>
      repo.list(other.id, { ...page, cursor: firstPage.meta.nextCursor })
    );
    const goal = await goals.create(
      FinancialGoal.create({
        ownerId: owner.id,
        title: "Voyage",
        targetAmount: "1000",
        savedAmount: "300.25",
        monthlyContribution: "50",
        currency: "EUR",
      })
    );
    const usd = await repo.create(owner.id, {
      name: "Dollars",
      currency: "USD",
      initialBalanceMinorUnits: 0,
    });
    await reject(
      () => repo.linkGoal(owner.id, usd.id, goal.id!),
      "CURRENCY_MISMATCH"
    );
    const linked = await repo.linkGoal(owner.id, account.id, goal.id!);
    assert.equal(linked.initialBalanceMinorUnits, 30025);
    assert.equal(linked.balanceMinorUnits, 30025);
    assert.equal(
      (await goals.findById(goal.id!, owner.id))!.savedMinorUnits,
      30025
    );
    assert.equal(
      (await goals.findById(goal.id!, owner.id))!.savingsAccountId,
      account.id
    );
    assert.deepEqual(
      await repo.linkGoal(owner.id, account.id, goal.id!),
      linked
    );
    await reject(
      () => repo.linkGoal(owner.id, second.id, goal.id!),
      "GOAL_ALREADY_LINKED"
    );
    await reject(
      () => repo.linkGoal(other.id, account.id, goal.id!),
      "NOT_FOUND"
    );
    const pristineGoal = await goals.create(
      FinancialGoal.create({
        ownerId: owner.id,
        title: "Ancien",
        targetAmount: "1000",
        savedAmount: "1",
        monthlyContribution: "0",
        currency: "EUR",
      })
    );
    await reject(
      () => repo.linkGoal(owner.id, second.id, pristineGoal.id!),
      "OPENING_BALANCE_CONFLICT"
    );
    const unlinked = await goals.findById(pristineGoal.id!, owner.id);
    assert.equal(unlinked!.savedMinorUnits, 100);
    const before = await forecast.forecast(
      owner.id,
      "2026-11",
      2,
      "EUR",
      today
    );
    assert.equal(before.months[0].plannedExpenseMinorUnits, 5000);
    assert.equal(before.months[0].goalSavingsMinorUnits, 0);
    assert.equal(before.months[0].plannedSavingsMinorUnits, 5000);
    assert.equal(
      (await repo.pending(owner.id, "2026-11", "EUR", page)).data[0]
        .amountMinorUnits,
      5000
    );
    // Concurrent confirmation is a replay, never a second ledger entry.
    const confirmations = await Promise.all([
      repo.resolve(owner.id, account.id, "2026-11", "CONFIRMED"),
      repo.resolve(owner.id, account.id, "2026-11", "CONFIRMED"),
    ]);
    assert.equal(confirmations[0].movement!.id, confirmations[1].movement!.id);
    assert.equal(
      (await repo.get(owner.id, account.id)).balanceMinorUnits,
      35025
    );
    assert.equal(
      (await repo.pending(owner.id, "2026-11", "EUR", page)).data.length,
      0
    );
    await reject(
      () => repo.resolve(owner.id, account.id, "2026-11", "CANCELED"),
      "OCCURRENCE_ALREADY_RESOLVED"
    );
    const after = await forecast.forecast(owner.id, "2026-11", 2, "EUR", today);
    assert.equal(
      after.months[0].forecastRemainingMinorUnits,
      before.months[0].forecastRemainingMinorUnits
    );
    assert.equal(after.months[0].plannedExpenseMinorUnits, 0);
    assert.equal(after.currentRealRemainingMinorUnits, -5000);
    const moved = await repo.transfer(
      owner.id,
      account.id,
      transfer("manual-transfer")
    );
    assert.equal(
      (await repo.transfer(owner.id, account.id, transfer("manual-transfer")))
        .id,
      moved.id
    );
    await reject(
      () =>
        repo.transfer(owner.id, account.id, transfer("manual-transfer", 102)),
      "IDEMPOTENCY_CONFLICT"
    );
    await repo.transfer(owner.id, account.id, {
      ...transfer("cover-negative", 50),
      direction: "FROM_SAVINGS",
      reason: "NEGATIVE_COVERAGE",
    });
    await repo.transfer(owner.id, account.id, {
      ...transfer("month-end-transfer", 25),
      reason: "MONTH_END",
    });
    await reject(
      () =>
        repo.transfer(owner.id, account.id, {
          ...transfer("overdraft-transfer", 999999),
          direction: "FROM_SAVINGS",
        }),
      "INSUFFICIENT_SAVINGS"
    );
    // Exact ledger formula and no analytics entries of either kind.
    const ledger = await prisma.savingsMovement.findMany({
      where: { userId: owner.id, accountId: account.id },
    });
    assert.equal(
      (await repo.get(owner.id, account.id)).balanceMinorUnits,
      balanceFromLedger(
        30025,
        ledger.map(
          (row) =>
            Number(row.amountMinorUnits) *
            (row.direction === "TO_SAVINGS" ? 1 : -1)
        )
      )
    );
    const category = await prisma.operationCategory.create({
      data: { userId: owner.id, name: "Tests analyses" },
    });
    await prisma.oneOffOperationRecord.createMany({
      data: [
        {
          userId: owner.id,
          categoryId: category.id,
          title: "Revenu réel",
          amount: "7.00",
          currency: "EUR",
          type: "ENTREE",
          operationDate: new Date(`${today}T00:00:00Z`),
        },
        {
          userId: owner.id,
          categoryId: category.id,
          title: "Dépense réelle",
          amount: "3.00",
          currency: "EUR",
          type: "DEPENSE",
          operationDate: new Date(`${today}T00:00:00Z`),
        },
      ],
    });
    const analytics = await new PrismaOperationAnalyticsRepository(
      prisma
    ).aggregate(owner.id, {
      from: "2026-11-01",
      to: "2026-11-30",
      currency: "EUR",
      groupBy: "month",
      splitBy: null,
      kind: null,
    });
    assert.deepEqual(
      analytics.map((row) => [row.kind, row.cents, row.count]).sort(),
      [
        ["DEPENSE", 300, 1],
        ["ENTREE", 700, 1],
      ]
    );
    const mixedCurrent = new PrismaCurrentAccount(prisma);
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const result = await mixedCurrent.history(owner.id, "2026-11", "EUR", {
        limit: 2,
        cursor,
      });
      for (const row of result.data) {
        const key = `${row.source}:${row.id}`;
        assert.ok(!seen.has(key));
        seen.add(key);
      }
      cursor = result.meta.nextCursor;
    } while (cursor !== null);
    assert.equal(seen.size, 6);
    const mixedFirst = await mixedCurrent.history(
      owner.id,
      "2026-11",
      "EUR",
      page
    );
    await assert.rejects(() =>
      mixedCurrent.history(other.id, "2026-11", "EUR", {
        ...page,
        cursor: mixedFirst.meta.nextCursor,
      })
    );
    await assert.rejects(() =>
      mixedCurrent.history(owner.id, "2026-11", "USD", {
        ...page,
        cursor: mixedFirst.meta.nextCursor,
      })
    );
    await prisma.oneOffOperationRecord.deleteMany({
      where: { userId: owner.id, categoryId: category.id },
    });
    await prisma.operationCategory.delete({ where: { id: category.id } });
    const history = await repo.history(owner.id, account.id, page);
    assert.equal(history.meta.hasNext, true);
    assert.notEqual(
      (
        await repo.history(owner.id, account.id, {
          ...page,
          cursor: history.meta.nextCursor,
        })
      ).data[0].id,
      history.data[0].id
    );
    await assert.rejects(() =>
      repo.history(owner.id, second.id, {
        ...page,
        cursor: history.meta.nextCursor,
      })
    );
    const current = new PrismaCurrentAccount(prisma);
    const currentHistory = await current.history(
      owner.id,
      "2026-11",
      "EUR",
      page
    );
    assert.equal(currentHistory.data[0].kind, "VIREMENT");
    assert.equal(
      (await current.summary(owner.id, "2026-11", "EUR", today))
        .balanceMinorUnits,
      -5076
    );
    const updatedGoal = await goals.findById(goal.id!, owner.id);
    await reject(
      () =>
        goals.update(
          FinancialGoal.create({
            id: goal.id!,
            ownerId: owner.id,
            title: "Voyage renommé",
            targetAmount: "1000",
            savedAmount: "1",
            monthlyContribution: "50",
            currency: "EUR",
          })
        ),
      "LINKED_GOAL_BALANCE_READ_ONLY"
    );
    const renamed = await goals.update(
      FinancialGoal.create({
        id: goal.id!,
        ownerId: owner.id,
        title: "Voyage renommé",
        targetAmount: "1000",
        savedAmount: (updatedGoal!.savedMinorUnits / 100).toFixed(2),
        monthlyContribution: "50",
        currency: "EUR",
      })
    );
    assert.equal(renamed!.savedMinorUnits, 35101);
    today = "2026-12-02";
    const count = await prisma.savingsMovement.count({
      where: { userId: owner.id },
    });
    await repo.resolve(owner.id, account.id, "2026-12", "CANCELED");
    await repo.resolve(owner.id, account.id, "2026-12", "CANCELED");
    assert.equal(
      await prisma.savingsMovement.count({ where: { userId: owner.id } }),
      count
    );
    assert.equal(
      (await repo.pending(owner.id, "2026-12", "EUR", page)).data.length,
      0
    );
    // A past transfer atomically corrects the closed month and the next carry.
    await current.summary(owner.id, "2026-12", "EUR", today);
    await repo.transfer(owner.id, account.id, {
      ...transfer("historical-transfer", 100),
      operationDate: "2026-11-30",
    });
    assert.equal(
      (await current.summary(owner.id, "2026-12", "EUR", today)).budget
        .carryInMinorUnits,
      -5176
    );
    await repo.update(owner.id, account.id, { archived: true });
    assert.equal(
      (await repo.pending(owner.id, "2027-01", "EUR", page)).data.length,
      0
    );
    await reject(
      () => repo.transfer(owner.id, account.id, transfer("archived-transfer")),
      "ACCOUNT_ARCHIVED"
    );
    assert.equal(
      (await repo.history(owner.id, account.id, page)).data.length,
      1
    );
    await goals.delete(goal.id!, owner.id);
    assert.equal((await repo.get(owner.id, account.id)).goalId, null);
    assert.equal(
      (await repo.resolve(owner.id, account.id, "2026-11", "CONFIRMED"))
        .movement!.id,
      confirmations[0].movement!.id
    );
    assert.equal(
      (await repo.resolve(owner.id, account.id, "2026-12", "CANCELED"))
        .movement,
      null
    );
    assert.equal(
      (
        await repo.transfer(owner.id, account.id, {
          direction: "TO_SAVINGS",
          amountMinorUnits: 101,
          operationDate: "2026-11-07",
          reason: "MANUAL",
          idempotencyKey: "manual-transfer",
        })
      ).id,
      moved.id
    );
    assert.ok((await repo.get(owner.id, account.id)).balanceMinorUnits > 0);
    console.log(
      "Savings persistence, ownership, monthly confirmation, analytics exclusion and historical budget tests passed"
    );
  } finally {
    await prisma.oneOffOperationRecord.deleteMany({
      where: { userId: { in: [owner.id, other.id] } },
    });
    await prisma.operationCategory.deleteMany({
      where: { userId: { in: [owner.id, other.id] } },
    });
    await prisma.utilisateur.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
    await prisma.$disconnect();
  }
}
run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
