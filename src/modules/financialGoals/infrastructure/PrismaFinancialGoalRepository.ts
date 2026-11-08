import { SavingsError } from "../../savings/domain/Savings";
import { lockReconciliationOwner } from "../../reconciliation/infrastructure/reconciliationLocks";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  createCursorPage,
  CursorContext,
  CursorPage,
  decodePositiveIntegerCursor,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";
import { FinancialGoalRepository } from "../application";
import { FinancialGoal } from "../domain";

type DecimalValue = { toFixed(fractionDigits: number): string };

type GoalRow = Readonly<{
  id: number;
  savingsLink?: {
    accountId: number;
    account: { balanceMinorUnits: bigint };
  } | null;
  title: string;
  targetAmount: DecimalValue;
  savedAmount: DecimalValue;
  monthlyContribution: DecimalValue;
  currency: string;
  targetDate: Date | null;
  userId: number;
}>;

const include = {
  savingsLink: {
    include: { account: { select: { balanceMinorUnits: true } } },
  },
} as const;

const amountOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

export class PrismaFinancialGoalRepository implements FinancialGoalRepository {
  public constructor(
    private readonly prisma: PrismaClient | Prisma.TransactionClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {}

  public async listByOwner(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<FinancialGoal>> {
    const context: CursorContext = {
      resource: "financial-goals",
      scope: `owner:${ownerId}`,
    };
    const afterId = decodePositiveIntegerCursor(page, context, this.cursors);
    const rows = await this.prisma.objectifFinancier.findMany({
      where:
        afterId === null
          ? { userId: ownerId }
          : { userId: ownerId, id: { gt: afterId } },
      include,
      orderBy: { id: "asc" },
      take: page.limit + 1,
    });
    return createCursorPage(
      rows.map((row) => this.toDomain(row)),
      page,
      context,
      (goal) => {
        if (goal.id == null) throw invalidPagination();
        return [goal.id];
      },
      this.cursors
    );
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<FinancialGoal | null> {
    const row = await this.prisma.objectifFinancier.findFirst({
      where: { id, userId: ownerId },
      include,
    });
    return row == null ? null : this.toDomain(row);
  }

  /** A complete owner/currency snapshot is needed for totals, not a list page. */
  public async listForSavingsCapacity(
    ownerId: number,
    currency: string
  ): Promise<readonly FinancialGoal[]> {
    const rows = await this.prisma.objectifFinancier.findMany({
      where: { userId: ownerId, currency },
      include,
      orderBy: { id: "asc" },
    });
    return rows.map((row) => this.toDomain(row));
  }

  public async create(goal: FinancialGoal): Promise<FinancialGoal> {
    return this.toDomain(
      await this.prisma.objectifFinancier.create({
        data: this.toPersistence(goal),
      })
    );
  }

  public async update(goal: FinancialGoal): Promise<FinancialGoal | null> {
    if (goal.id == null) return null;
    const update = async (tx: Prisma.TransactionClient) => {
      await lockReconciliationOwner(tx, goal.ownerId);
      const current = await tx.objectifFinancier.findFirst({
        where: { id: goal.id, userId: goal.ownerId },
        include,
      });
      if (!current) return null;
      const data = this.toPersistence(goal);
      if (current.savingsLink) {
        if (
          goal.currency !== current.currency ||
          goal.savedMinorUnits !==
            Number(current.savingsLink.account.balanceMinorUnits)
        )
          throw new SavingsError("LINKED_GOAL_BALANCE_READ_ONLY");
        // Keep the legacy value for rollback; the active projection comes from the account.
        data.savedAmount = current.savedAmount.toFixed(2);
      }
      return this.toDomain(
        await tx.objectifFinancier.update({
          where: { id: current.id },
          data,
          include,
        })
      );
    };
    return "$transaction" in this.prisma
      ? this.prisma.$transaction(update)
      : update(this.prisma);
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const remove = async (tx: Prisma.TransactionClient) => {
      await lockReconciliationOwner(tx, ownerId);
      return (
        (
          await tx.objectifFinancier.deleteMany({
            where: { id, userId: ownerId },
          })
        ).count === 1
      );
    };
    return "$transaction" in this.prisma
      ? this.prisma.$transaction(remove)
      : remove(this.prisma);
  }

  private toPersistence(goal: FinancialGoal) {
    return {
      title: goal.title,
      targetAmount: amountOf(goal.targetMinorUnits),
      savedAmount: amountOf(goal.savedMinorUnits),
      monthlyContribution: amountOf(goal.monthlyContributionMinorUnits),
      currency: goal.currency,
      targetDate:
        goal.targetDate == null
          ? null
          : new Date(`${goal.targetDate}T00:00:00.000Z`),
      userId: goal.ownerId,
    };
  }

  private toDomain(row: GoalRow): FinancialGoal {
    return FinancialGoal.create({
      id: row.id,
      ownerId: row.userId,
      title: row.title,
      targetAmount: row.targetAmount.toFixed(2),
      savedAmount: row.savingsLink
        ? amountOf(Number(row.savingsLink.account.balanceMinorUnits))
        : row.savedAmount.toFixed(2),
      ...(row.savingsLink
        ? { savingsAccountId: row.savingsLink.accountId }
        : {}),
      monthlyContribution: row.monthlyContribution.toFixed(2),
      currency: row.currency,
      targetDate: row.targetDate?.toISOString().slice(0, 10) ?? null,
    });
  }
}
