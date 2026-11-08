import {
  Prisma,
  PrismaClient,
  SavingsAccount,
  SavingsMovement,
} from "@prisma/client";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import {
  createCursorPage,
  decodePositiveIntegerCursor,
  PaginationRequest,
  paginationCursorCodec,
} from "../../pagination";
import { lockReconciliationOwner } from "../../reconciliation/infrastructure/reconciliationLocks";
import { BudgetCorrectionService } from "../../budgetPeriods/application/BudgetCorrectionService";
import { BudgetPeriodEngine } from "../../budgetPeriods/application/BudgetPeriodEngine";
import { PrismaBudgetPeriodRepository } from "../../budgetPeriods/infrastructure/PrismaBudgetPeriodRepository";
import {
  SavingsRepository,
  Account,
  Movement,
  SavingsOccurrence,
} from "../application/SavingsRepository";
import {
  applyTransfer,
  SavingsError,
  Transfer,
  validateAccount,
  validateTransfer,
} from "../domain/Savings";
import { plannedSavingsWhere } from "./plannedSavings";

const date = (value: string) => new Date(`${value}T00:00:00Z`);
const civil = (value: Date) => value.toISOString().slice(0, 10);
const movementDto = (row: SavingsMovement): Movement => ({
  id: row.id,
  accountId: row.accountId,
  type: "VIREMENT",
  currency: row.currency,
  direction: row.direction,
  reason: row.reason,
  amountMinorUnits: Number(row.amountMinorUnits),
  operationDate: civil(row.operationDate),
  idempotencyKey: row.idempotencyKey,
});
const accountDto = (
  row: SavingsAccount & { goalLink: { goalId: number } | null }
): Account => ({
  id: row.id,
  name: row.name,
  currency: row.currency,
  initialBalanceMinorUnits: Number(row.initialBalanceMinorUnits),
  balanceMinorUnits: Number(row.balanceMinorUnits),
  archived: row.archived,
  goalId: row.goalLink?.goalId ?? null,
});
const include = { goalLink: { select: { goalId: true } } } as const;

export class PrismaSavingsRepository implements SavingsRepository {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  private async write<T>(
    owner: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
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

  private async account(
    tx: Prisma.TransactionClient,
    owner: number,
    id: number
  ) {
    const row = await tx.savingsAccount.findFirst({
      where: { id, userId: owner },
      include,
    });
    if (!row) throw new SavingsError("NOT_FOUND");
    return row;
  }

  public async get(owner: number, id: number) {
    return accountDto(await this.account(this.prisma, owner, id));
  }

  public async list(owner: number, page: PaginationRequest) {
    const context = { resource: "savings-accounts", scope: `owner:${owner}` };
    const after = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    const rows = await this.prisma.savingsAccount.findMany({
      where: {
        userId: owner,
        ...(after === null ? {} : { id: { gt: after } }),
      },
      include,
      orderBy: { id: "asc" },
      take: page.limit + 1,
    });
    return createCursorPage(
      rows.map(accountDto),
      page,
      context,
      (row) => [row.id],
      paginationCursorCodec
    );
  }

  public async create(
    owner: number,
    input: { name: string; currency: string; initialBalanceMinorUnits: number }
  ) {
    const normalized = validateAccount(input);
    return this.write(owner, async (tx) =>
      accountDto(
        await tx.savingsAccount.create({
          data: {
            userId: owner,
            ...normalized,
            balanceMinorUnits: normalized.initialBalanceMinorUnits,
          },
          include,
        })
      )
    );
  }

  public async update(
    owner: number,
    id: number,
    input: { name?: string; archived?: boolean }
  ) {
    return this.write(owner, async (tx) => {
      const row = await this.account(tx, owner, id);
      if (input.name !== undefined)
        validateAccount({
          name: input.name,
          currency: row.currency,
          initialBalanceMinorUnits: 0,
        });
      return accountDto(
        await tx.savingsAccount.update({
          where: { id },
          data: {
            ...(input.archived === undefined
              ? {}
              : { archived: input.archived }),
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
          },
          include,
        })
      );
    });
  }

  public async linkGoal(owner: number, id: number, goalId: number) {
    return this.write(owner, async (tx) => {
      let account = await this.account(tx, owner, id);
      const goal = await tx.objectifFinancier.findFirst({
        where: { id: goalId, userId: owner },
        include: { savingsLink: true },
      });
      if (!goal) throw new SavingsError("NOT_FOUND");
      if (account.goalLink?.goalId === goalId) return accountDto(account);
      if (account.archived) throw new SavingsError("ACCOUNT_ARCHIVED");
      if (account.goalLink || goal.savingsLink)
        throw new SavingsError("GOAL_ALREADY_LINKED");
      if (account.currency !== goal.currency)
        throw new SavingsError("CURRENCY_MISMATCH");
      const saved = Number(goal.savedAmount.mul(100));
      if (saved > 0) {
        if (
          account.initialBalanceMinorUnits !== BigInt(0) ||
          (await tx.savingsMovement.count({
            where: { accountId: id, userId: owner },
          }))
        )
          throw new SavingsError("OPENING_BALANCE_CONFLICT");
        account = await tx.savingsAccount.update({
          where: { id },
          data: { initialBalanceMinorUnits: saved, balanceMinorUnits: saved },
          include,
        });
      }
      await tx.savingsGoalLink.create({
        data: {
          accountId: id,
          goalId,
          userId: owner,
          linkedOn: date(this.today()),
        },
      });
      return { ...accountDto(account), goalId };
    });
  }

  private async makeTransfer(
    tx: Prisma.TransactionClient,
    owner: number,
    id: number,
    input: Transfer,
    deferCorrection = false
  ): Promise<Movement> {
    validateTransfer(input, this.today());
    const previous = await tx.savingsMovement.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: owner,
          idempotencyKey: input.idempotencyKey,
        },
      },
    });
    if (previous) {
      const known = movementDto(previous);
      if (
        known.accountId !== id ||
        known.amountMinorUnits !== input.amountMinorUnits ||
        known.direction !== input.direction ||
        known.reason !== input.reason ||
        known.operationDate !== input.operationDate
      )
        throw new SavingsError("IDEMPOTENCY_CONFLICT");
      return known;
    }
    const account = await this.account(tx, owner, id);
    if (account.archived) throw new SavingsError("ACCOUNT_ARCHIVED");
    const balance = applyTransfer(Number(account.balanceMinorUnits), input);
    const movement = await tx.savingsMovement.create({
      data: {
        direction: input.direction,
        amountMinorUnits: input.amountMinorUnits,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        userId: owner,
        accountId: id,
        currency: account.currency,
        operationDate: date(input.operationDate),
      },
    });
    await tx.savingsAccount.update({
      where: { id },
      data: { balanceMinorUnits: balance },
    });
    // Correction and ledger commit together: no committed transfer with stale historical carry.
    if (!deferCorrection)
      await this.correctBudget(
        tx,
        owner,
        account.currency,
        input.operationDate
      );
    return movementDto(movement);
  }

  private async correctBudget(
    tx: Prisma.TransactionClient,
    owner: number,
    currency: string,
    operationDate: string
  ) {
    await new BudgetCorrectionService(
      new BudgetPeriodEngine(
        new PrismaBudgetPeriodRepository(tx, paginationCursorCodec, this.today)
      ),
      this.today
    ).afterOperationChange(owner, [{ currency, operationDate }]);
  }

  public async transfer(owner: number, id: number, input: Transfer) {
    if (input.reason === "GOAL" || input.idempotencyKey.startsWith("goal:"))
      throw new SavingsError("INVALID_REASON");
    return this.write(owner, (tx) => this.makeTransfer(tx, owner, id, input));
  }

  public async history(owner: number, id: number, page: PaginationRequest) {
    await this.get(owner, id);
    const context = {
      resource: "savings-movements",
      scope: `owner:${owner}:account:${id}`,
    };
    const after = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    const rows = await this.prisma.savingsMovement.findMany({
      where: {
        userId: owner,
        accountId: id,
        ...(after === null ? {} : { id: { lt: after } }),
      },
      orderBy: { id: "desc" },
      take: page.limit + 1,
    });
    return createCursorPage(
      rows.map(movementDto),
      page,
      context,
      (row) => [row.id],
      paginationCursorCodec
    );
  }

  private async pendingRows(
    tx: Prisma.TransactionClient,
    owner: number,
    month: string,
    currency: string,
    after: number,
    limit: number
  ): Promise<SavingsOccurrence[]> {
    const rows = await tx.$queryRaw<
      {
        accountId: number;
        goalId: number;
        title: string;
        amount: Prisma.Decimal;
        currency: string;
        operationDate: Date;
      }[]
    >(Prisma.sql`
      SELECT a.id AS accountId, g.id AS goalId, g.titre AS title, g.monthlyContribution * 100 AS amount,
        a.currency, GREATEST(l.linkedOn, ${date(
          `${month}-01`
        )}) AS operationDate
      ${plannedSavingsWhere(owner, month, currency)} AND a.id > ${after}
      ORDER BY a.id ASC LIMIT ${limit}
    `);
    return rows.map((row) => ({
      accountId: row.accountId,
      goalId: row.goalId,
      title: row.title,
      amountMinorUnits: Number(row.amount),
      currency: row.currency,
      month,
      operationDate: civil(row.operationDate),
    }));
  }

  public async pending(
    owner: number,
    month: string,
    currency: string,
    page: PaginationRequest
  ) {
    const context = {
      resource: "savings-occurrences",
      scope: `owner:${owner}:${month}:${currency}`,
    };
    const after = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    const rows = await this.pendingRows(
      this.prisma,
      owner,
      month,
      currency,
      after ?? 0,
      page.limit + 1
    );
    return createCursorPage(
      rows,
      page,
      context,
      (row) => [row.accountId],
      paginationCursorCodec
    );
  }

  public async resolve(
    owner: number,
    id: number,
    month: string,
    status: "CONFIRMED" | "CANCELED"
  ) {
    return this.write(owner, async (tx) => {
      const previous = await tx.savingsOccurrenceResolution.findUnique({
        where: {
          userId_accountId_month: {
            userId: owner,
            accountId: id,
            month: date(`${month}-01`),
          },
        },
        include: { movement: true },
      });
      if (previous) {
        if (previous.status !== status)
          throw new SavingsError("OCCURRENCE_ALREADY_RESOLVED");
        return {
          status,
          movement: previous.movement ? movementDto(previous.movement) : null,
        };
      }
      const account = await this.account(tx, owner, id);
      const occurrence = (
        await this.pendingRows(tx, owner, month, account.currency, id - 1, 1)
      )[0];
      if (!occurrence || occurrence.accountId !== id)
        throw new SavingsError("NOT_FOUND");
      if (month > this.today().slice(0, 7))
        throw new SavingsError("INVALID_DATE");
      const movement =
        status === "CANCELED"
          ? null
          : await this.makeTransfer(
              tx,
              owner,
              id,
              {
                amountMinorUnits: occurrence.amountMinorUnits,
                direction: "TO_SAVINGS",
                reason: "GOAL",
                operationDate: occurrence.operationDate,
                idempotencyKey: `goal:${id}:${month}`,
              },
              true
            );
      await tx.savingsOccurrenceResolution.create({
        data: {
          userId: owner,
          accountId: id,
          month: date(`${month}-01`),
          sourceGoalId: occurrence.goalId,
          title: occurrence.title,
          amountMinorUnits: occurrence.amountMinorUnits,
          currency: occurrence.currency,
          operationDate: date(occurrence.operationDate),
          status,
          movementId: movement?.id ?? null,
        },
      });
      if (movement)
        await this.correctBudget(
          tx,
          owner,
          movement.currency,
          movement.operationDate
        );
      return { status, movement };
    });
  }
}
