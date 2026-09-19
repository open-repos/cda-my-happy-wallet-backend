import {
  BudgetPeriodStatus,
  PrismaClient,
  TypeOperationEnum,
  TypeOperationFixeEnum,
} from "@prisma/client";
import {
  BudgetPeriodRepository,
  BudgetPeriodState,
  CloseBudgetPeriodInput,
} from "../application";
import { BudgetMovement } from "../domain";
import { monthBounds } from "../domain/BudgetPeriod";

type DecimalValue = { toFixed(fractionDigits: number): string };

const minorUnitsOf = (value: DecimalValue): number => {
  const amount = value.toFixed(2);
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(amount);
  if (match == null) throw new Error("INVALID_PERSISTED_AMOUNT");
  const magnitude = Number(match[2]) * 100 + Number(match[3]);
  const signed = match[1] === "-" ? -magnitude : magnitude;
  if (!Number.isSafeInteger(signed)) {
    throw new Error("INVALID_PERSISTED_AMOUNT");
  }
  return signed;
};

const decimalOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

export class PrismaBudgetPeriodRepository implements BudgetPeriodRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async find(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<BudgetPeriodState | null> {
    const row = await this.prisma.budgetPeriod.findUnique({
      where: {
        userId_periodStart_currency: {
          userId: ownerId,
          periodStart: this.periodStart(month),
          currency,
        },
      },
    });
    return row == null ? null : this.toState(row);
  }

  public async open(
    ownerId: number,
    month: string,
    currency: string,
    fixedIncomeMinorUnits: number,
    fixedExpenseMinorUnits: number
  ): Promise<BudgetPeriodState> {
    const row = await this.prisma.budgetPeriod.upsert({
      where: {
        userId_periodStart_currency: {
          userId: ownerId,
          periodStart: this.periodStart(month),
          currency,
        },
      },
      create: {
        userId: ownerId,
        periodStart: this.periodStart(month),
        currency,
        fixedIncome: decimalOf(fixedIncomeMinorUnits),
        fixedExpense: decimalOf(fixedExpenseMinorUnits),
        baseAmount: decimalOf(fixedIncomeMinorUnits - fixedExpenseMinorUnits),
      },
      update: {},
    });
    return this.toState(row);
  }

  public async updateOpenFixedSnapshot(
    id: number,
    ownerId: number,
    fixedIncomeMinorUnits: number,
    fixedExpenseMinorUnits: number
  ): Promise<BudgetPeriodState> {
    const result = await this.prisma.budgetPeriod.updateMany({
      where: { id, userId: ownerId, status: BudgetPeriodStatus.OPEN },
      data: {
        fixedIncome: decimalOf(fixedIncomeMinorUnits),
        fixedExpense: decimalOf(fixedExpenseMinorUnits),
        baseAmount: decimalOf(fixedIncomeMinorUnits - fixedExpenseMinorUnits),
        revision: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new Error("BUDGET_PERIOD_NOT_OPEN");
    return this.findById(id, ownerId);
  }

  public async close(
    id: number,
    ownerId: number,
    totals: CloseBudgetPeriodInput
  ): Promise<BudgetPeriodState> {
    await this.prisma.budgetPeriod.updateMany({
      where: { id, userId: ownerId, status: BudgetPeriodStatus.OPEN },
      data: {
        status: BudgetPeriodStatus.CLOSED,
        actualIncome: decimalOf(totals.actualIncomeMinorUnits),
        actualExpense: decimalOf(totals.actualExpenseMinorUnits),
        realRemaining: decimalOf(totals.realRemainingMinorUnits),
        closedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    return this.findById(id, ownerId);
  }

  public async fixedTotals(
    ownerId: number,
    currency: string
  ): Promise<
    Readonly<{ incomeMinorUnits: number; expenseMinorUnits: number }>
  > {
    const totals = await this.prisma.operationFixe.groupBy({
      by: ["typeOperation"],
      where: { userId: ownerId, devise: currency },
      _sum: { montant: true },
    });
    let incomeMinorUnits = 0;
    let expenseMinorUnits = 0;
    for (const total of totals) {
      const amount =
        total._sum.montant == null ? 0 : minorUnitsOf(total._sum.montant);
      if (total.typeOperation === TypeOperationFixeEnum.REVENU) {
        incomeMinorUnits += amount;
      } else {
        expenseMinorUnits += amount;
      }
    }
    return { incomeMinorUnits, expenseMinorUnits };
  }

  public async actualMovements(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<readonly BudgetMovement[]> {
    const bounds = monthBounds(month);
    const rows = await this.prisma.oneOffOperationRecord.findMany({
      where: {
        userId: ownerId,
        currency,
        operationDate: {
          gte: new Date(`${bounds.start}T00:00:00.000Z`),
          lte: new Date(`${bounds.end}T00:00:00.000Z`),
        },
      },
      select: { amount: true, type: true, operationDate: true },
      orderBy: [{ operationDate: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => ({
      operationDate: row.operationDate.toISOString().slice(0, 10),
      minorUnits: minorUnitsOf(row.amount),
      kind:
        row.type === TypeOperationEnum.ENTREE
          ? ("ENTREE" as const)
          : ("DEPENSE" as const),
    }));
  }

  private async findById(
    id: number,
    ownerId: number
  ): Promise<BudgetPeriodState> {
    const row = await this.prisma.budgetPeriod.findFirst({
      where: { id, userId: ownerId },
    });
    if (row == null) throw new Error("BUDGET_PERIOD_NOT_FOUND");
    return this.toState(row);
  }

  private toState(row: {
    id: number;
    userId: number;
    periodStart: Date;
    currency: string;
    status: BudgetPeriodStatus;
    fixedIncome: DecimalValue;
    fixedExpense: DecimalValue;
    actualIncome: DecimalValue;
    actualExpense: DecimalValue;
    realRemaining: DecimalValue;
    revision: number;
    closedAt: Date | null;
  }): BudgetPeriodState {
    return {
      id: row.id,
      ownerId: row.userId,
      month: row.periodStart.toISOString().slice(0, 7),
      currency: row.currency,
      status: row.status,
      fixedIncomeMinorUnits: minorUnitsOf(row.fixedIncome),
      fixedExpenseMinorUnits: minorUnitsOf(row.fixedExpense),
      actualIncomeMinorUnits: minorUnitsOf(row.actualIncome),
      actualExpenseMinorUnits: minorUnitsOf(row.actualExpense),
      realRemainingMinorUnits: minorUnitsOf(row.realRemaining),
      revision: row.revision,
      closedAt: row.closedAt,
    };
  }

  private periodStart(month: string): Date {
    return new Date(`${monthBounds(month).start}T00:00:00.000Z`);
  }
}
