import { PrismaClient } from "@prisma/client";
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
  title: string;
  targetAmount: DecimalValue;
  savedAmount: DecimalValue;
  monthlyContribution: DecimalValue;
  currency: string;
  targetDate: Date | null;
  userId: number;
}>;

const amountOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

export class PrismaFinancialGoalRepository implements FinancialGoalRepository {
  public constructor(
    private readonly prisma: PrismaClient,
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
    const result = await this.prisma.objectifFinancier.updateMany({
      where: { id: goal.id, userId: goal.ownerId },
      data: this.toPersistence(goal),
    });
    return result.count === 0 ? null : this.findById(goal.id, goal.ownerId);
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    return (
      (
        await this.prisma.objectifFinancier.deleteMany({
          where: { id, userId: ownerId },
        })
      ).count === 1
    );
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
      savedAmount: row.savedAmount.toFixed(2),
      monthlyContribution: row.monthlyContribution.toFixed(2),
      currency: row.currency,
      targetDate: row.targetDate?.toISOString().slice(0, 10) ?? null,
    });
  }
}
