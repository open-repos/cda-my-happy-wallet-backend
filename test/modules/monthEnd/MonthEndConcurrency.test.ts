/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import { Prisma, PrismaClient } from "@prisma/client";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application/BudgetPeriodEngine";
import { BudgetPeriodRepository } from "../../../src/modules/budgetPeriods/application/BudgetPeriodRepository";
import { BudgetForecastService } from "../../../src/modules/budgetPeriods/application/BudgetForecastService";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure/PrismaBudgetPeriodRepository";
import { PrismaMonthEndRepository } from "../../../src/modules/monthEnd/infrastructure/PrismaMonthEndRepository";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw Error("Disposable test database required");
const prisma = new PrismaClient();
const email = "month-end-concurrency@test.local";
const today = () => "2026-11-01";
const gate = () => {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
};

/** Pause between budget/carry calculation and allocation lookup, inside the read lock. */
function pausingRepository(
  repository: BudgetPeriodRepository,
  paused: ReturnType<typeof gate>,
  resume: ReturnType<typeof gate>
): BudgetPeriodRepository {
  return new Proxy(repository, {
    get(target, key) {
      if (key === "withOwnerLock")
        return <T>(
          owner: number,
          read: (periods: BudgetPeriodRepository) => Promise<T>
        ) =>
          target.withOwnerLock!(owner, (tx) =>
            read(pausingRepository(tx, paused, resume))
          );
      if (key === "monthEndDecision")
        return async (
          ...args: Parameters<
            NonNullable<BudgetPeriodRepository["monthEndDecision"]>
          >
        ) => {
          paused.open();
          await resume.promise;
          return target.monthEndDecision!(...args);
        };
      return Reflect.get(target, key);
    },
  });
}

async function run() {
  await prisma.utilisateur.deleteMany({ where: { email } });
  const owner = await prisma.utilisateur.create({
    data: { email, firstname: "Read", lastname: "Race", password: "test-only" },
  });
  try {
    const category = await prisma.operationCategory.create({
      data: { userId: owner.id, name: "Test" },
    });
    await prisma.oneOffOperationRecord.create({
      data: {
        userId: owner.id,
        categoryId: category.id,
        title: "Solde",
        type: "ENTREE",
        amount: "150.00",
        currency: "EUR",
        operationDate: new Date("2026-10-31"),
      },
    });
    const account = await prisma.savingsAccount.create({
      data: { userId: owner.id, name: "Épargne", currency: "EUR" },
    });
    const periods = new PrismaBudgetPeriodRepository(prisma, undefined, today);
    await new BudgetPeriodEngine(periods).summarize(
      owner.id,
      "2026-11",
      "EUR",
      today()
    );

    async function interleave<T>(
      read: (periods: BudgetPeriodRepository) => Promise<T>,
      revision: number,
      amount: number
    ) {
      const paused = gate(),
        resume = gate(),
        writerStarted = gate();
      const reading = read(pausingRepository(periods, paused, resume));
      await paused.promise;
      const writerClient = new Proxy(prisma, {
        get(target, key) {
          if (key !== "$transaction") return Reflect.get(target, key);
          return (
            action: (tx: Prisma.TransactionClient) => Promise<unknown>,
            options: {
              timeout: number;
              isolationLevel: Prisma.TransactionIsolationLevel;
            }
          ) =>
            target.$transaction((tx) => {
              writerStarted.open();
              return action(tx);
            }, options);
        },
      });
      const writing = new PrismaMonthEndRepository(writerClient, today).put(
        owner.id,
        "2026-10",
        "EUR",
        {
          expectedRevision: revision,
          idempotencyKey: `read-race-revision-${revision}`,
          savings: [{ accountId: account.id, amountMinorUnits: amount }],
          coverage: [],
          exceptionalIncomeMinorUnits: 0,
        }
      );
      await writerStarted.promise;
      let state: string;
      try {
        state = await Promise.race([
          writing.then(() => "committed"),
          new Promise<string>((resolve) =>
            setTimeout(() => resolve("waiting-for-read"), 150)
          ),
        ]);
      } finally {
        resume.open();
      }
      const [result, written] = await Promise.all([reading, writing]);
      assert.equal(
        state,
        "waiting-for-read",
        "Allocation writer must wait until the budget/decision read finishes"
      );
      return { result, written };
    }
    const summary = await interleave(
      (repo) =>
        new BudgetPeriodEngine(repo).summarize(
          owner.id,
          "2026-10",
          "EUR",
          today()
        ),
      0,
      10000
    );
    assert.equal(summary.result.budget.realRemainingMinorUnits, 15000);
    assert.equal(summary.result.monthEndDecision, undefined);
    assert.equal(summary.written.carryMinorUnits, 5000);
    const forecast = await interleave(
      (repo) =>
        new BudgetForecastService(repo).forecast(
          owner.id,
          "2026-11",
          2,
          "EUR",
          today()
        ),
      1,
      9000
    );
    assert.equal(forecast.result.currentRealRemainingMinorUnits, 5000);
    assert.equal(forecast.result.carryDecision?.carryMinorUnits, 5000);
    assert.equal(
      forecast.result.carryDecision?.resultBeforeDecisionMinorUnits,
      15000
    );
    assert.equal(forecast.result.carryDecision?.requiresReview, false);
    assert.equal(forecast.result.carryDecision?.correctionDeltaMinorUnits, 0);
    assert.equal(forecast.written.carryMinorUnits, 6000);
    const compensations = await prisma.savingsMovement.findMany({
      where: { userId: owner.id, isCompensation: true },
    });
    assert.equal(compensations.length, 1);
    assert(
      compensations.every(
        (row) =>
          row.monthEndDecisionId !== null &&
          row.monthEndRevision !== null &&
          row.monthEndRevision > 0
      )
    );
    console.log(
      "Month-end concurrency: forced summary/forecast interleavings remain coherent and writers wait for the owner read lock"
    );
  } finally {
    await prisma.utilisateur.deleteMany({ where: { email } });
  }
}
run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
