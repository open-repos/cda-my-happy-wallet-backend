import { createHash, randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { BudgetPeriodEngine } from "../../budgetPeriods/application/BudgetPeriodEngine";
import { monthBounds } from "../../budgetPeriods/domain/BudgetPeriod";
import { PrismaBudgetPeriodRepository } from "../../budgetPeriods/infrastructure/PrismaBudgetPeriodRepository";
import { lockReconciliationOwner } from "../../reconciliation/infrastructure/reconciliationLocks";
import {
  MAX_SAVINGS_MINOR_UNITS,
  SavingsError,
} from "../../savings/domain/Savings";
import {
  assertDecisionPeriod,
  DecisionPlan,
  DecisionView,
  decisionView,
  EMPTY_PLAN,
  evaluateDecision,
  MonthEndError,
  normalizeDecision,
  transferAdjustments,
} from "../domain/MonthEnd";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
export class PrismaMonthEndRepository {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async get(
    owner: number,
    month: string,
    currency: string
  ): Promise<DecisionView> {
    const today = this.today();
    assertDecisionPeriod(month, currency, today);
    // Summary can close periods. Share the mutation lock to return a coherent decision/balance pair.
    return this.write(owner, async (tx) => {
      const periods = new PrismaBudgetPeriodRepository(
        tx,
        undefined,
        () => today
      );
      const { budget } = await new BudgetPeriodEngine(periods).summarize(
        owner,
        month,
        currency,
        today
      );
      const row = await tx.monthEndDecision.findUnique({
        where: {
          userId_month_currency: {
            userId: owner,
            month: date(`${month}-01`),
            currency,
          },
        },
      });
      return decisionView(
        month,
        currency,
        budget.realRemainingMinorUnits,
        row ?? undefined
      );
    });
  }

  public async put(
    owner: number,
    month: string,
    currency: string,
    body: unknown
  ): Promise<DecisionView> {
    const today = this.today();
    assertDecisionPeriod(month, currency, today);
    const input = normalizeDecision(body);
    const plan: DecisionPlan = {
      savings: input.savings,
      coverage: input.coverage,
      exceptionalIncomeMinorUnits: input.exceptionalIncomeMinorUnits,
    };
    const requestHash = createHash("sha256")
      .update(
        JSON.stringify({
          month,
          currency,
          expectedRevision: input.expectedRevision,
          ...plan,
        })
      )
      .digest("hex");
    return this.write(owner, async (tx) => {
      const receipt = await tx.monthEndDecisionReceipt.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: owner,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (receipt) {
        if (receipt.requestHash !== requestHash)
          throw new MonthEndError("IDEMPOTENCY_CONFLICT");
        return receipt.response as unknown as DecisionView;
      }
      const where = {
        userId_month_currency: {
          userId: owner,
          month: date(`${month}-01`),
          currency,
        },
      };
      const previous = await tx.monthEndDecision.findUnique({ where });
      if ((previous?.revision ?? 0) !== input.expectedRevision)
        throw new MonthEndError("REVISION_CONFLICT");
      const periods = new PrismaBudgetPeriodRepository(
        tx,
        undefined,
        () => today
      );
      const engine = new BudgetPeriodEngine(periods);
      const { budget } = await engine.summarize(owner, month, currency, today);
      const baseline =
        budget.realRemainingMinorUnits +
        Number(previous?.savingsMinorUnits ?? 0) -
        Number(previous?.coverageMinorUnits ?? 0) -
        Number(previous?.exceptionalIncomeMinorUnits ?? 0);
      const amounts = evaluateDecision(baseline, plan);
      const changes = transferAdjustments(
        previous
          ? (previous.allocations as unknown as DecisionPlan)
          : EMPTY_PLAN,
        plan
      );
      // Check every account, including unchanged allocations, inside the owner-locked transaction.
      const ids = [
        ...new Set(
          [...plan.savings, ...plan.coverage, ...changes].map(
            (row) => row.accountId
          )
        ),
      ];
      const balances = new Map<number, bigint>();
      for (const id of ids) {
        const account = await tx.savingsAccount.findFirst({
          where: { id, userId: owner },
        });
        if (!account) throw new SavingsError("NOT_FOUND");
        if (account.currency !== currency)
          throw new SavingsError("CURRENCY_MISMATCH");
        // An archived account may be reduced/canceled, but cannot receive a new allocation.
        if (
          account.archived &&
          changes.some(
            (change) => change.accountId === id && !change.isCompensation
          )
        )
          throw new SavingsError("ACCOUNT_ARCHIVED");
        let balance = account.balanceMinorUnits;
        for (const change of changes.filter(
          (change) => change.accountId === id
        ))
          balance +=
            BigInt(change.amountMinorUnits) *
            BigInt(change.direction === "TO_SAVINGS" ? 1 : -1);
        if (balance < BigInt(0)) throw new SavingsError("INSUFFICIENT_SAVINGS");
        if (balance > BigInt(MAX_SAVINGS_MINOR_UNITS))
          throw new SavingsError("BALANCE_LIMIT");
        balances.set(id, balance);
      }
      const revision = input.expectedRevision + 1;
      const operationDate = date(monthBounds(month).end);
      const data = {
        revision,
        referenceResultMinorUnits: baseline,
        savingsMinorUnits: amounts.savingsMinorUnits,
        coverageMinorUnits: amounts.coverageMinorUnits,
        exceptionalIncomeMinorUnits: amounts.exceptionalIncomeMinorUnits,
        allocations: plan as unknown as Prisma.InputJsonValue,
      };
      const decision = await tx.monthEndDecision.upsert({
        where,
        create: {
          ...data,
          userId: owner,
          month: date(`${month}-01`),
          operationDate,
          currency,
        },
        update: data,
      });
      for (const change of changes) {
        await tx.savingsMovement.create({
          data: {
            ...change,
            userId: owner,
            currency,
            operationDate,
            monthEndDecisionId: decision.id,
            monthEndRevision: revision,
            idempotencyKey: `month-end:${randomUUID()}`,
          },
        });
      }
      for (const [id, balance] of balances)
        await tx.savingsAccount.update({
          where: { id },
          data: { balanceMinorUnits: balance },
        });
      await engine.recalculateFrom(owner, month, currency, today);
      const response = decisionView(
        month,
        currency,
        amounts.carryMinorUnits,
        decision
      );
      await tx.monthEndDecisionReceipt.create({
        data: {
          userId: owner,
          decisionId: decision.id,
          revision,
          idempotencyKey: input.idempotencyKey,
          requestHash,
          response: response as unknown as Prisma.InputJsonValue,
        },
      });
      return response;
    });
  }
  private write<T>(
    owner: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockReconciliationOwner(tx, owner);
        return action(tx);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 20000,
      }
    );
  }
}
