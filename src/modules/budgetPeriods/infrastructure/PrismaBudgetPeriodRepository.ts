import {
  BudgetPeriodStatus,
  Prisma,
  PrismaClient,
  TypeOperationEnum,
  TypeOperationFixeEnum,
} from "@prisma/client";
import {
  BudgetPeriodRepository,
  BudgetPeriodState,
  CloseBudgetPeriodInput,
  RecalculatedPeriod,
} from "../application";
import {
  createCursorPage,
  CursorPage,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";
import { BudgetMovement, PlannedMovement } from "../domain";
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
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {}

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
    fixedExpenseMinorUnits: number,
    carryInMinorUnits: number
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
        carryIn: decimalOf(carryInMinorUnits),
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
        unresolvedEvents: totals.unresolvedEvents,
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

  public async plannedMovements(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<readonly PlannedMovement[]> {
    const monthStart = monthBounds(month).start;
    const occurrence = Prisma.sql`DATE_ADD(STR_TO_DATE(${monthStart}, '%Y-%m-%d'), INTERVAL LEAST(DAY(e.startDate), DAY(LAST_DAY(STR_TO_DATE(${monthStart}, '%Y-%m-%d')))) - 1 DAY)`;
    const rows = await this.prisma.$queryRaw<
      {
        occurrenceDate: Date;
        kind: "DEPENSE" | "ENTREE";
        total: DecimalValue;
        occurrences: bigint | number;
      }[]
    >(Prisma.sql`
      SELECT o.occurrenceDate, o.kind, SUM(o.amount) AS total,
             COUNT(*) AS occurrences
      FROM (
        SELECT e.id, e.kind, e.montant AS amount, ${occurrence} AS occurrenceDate
        FROM EvenementMensuel e
        WHERE e.userId = ${ownerId}
          AND e.devise = ${currency}
          AND (
            (e.recurrence = 'AUCUNE' AND DATE_FORMAT(e.startDate, '%Y-%m') = ${month})
            OR
            (e.recurrence = 'MENSUELLE'
              AND e.startDate <= LAST_DAY(STR_TO_DATE(${monthStart}, '%Y-%m-%d'))
              AND (e.endDate IS NULL OR ${occurrence} <= e.endDate))
          )
      ) o
      LEFT JOIN EventOccurrenceResolution r
        ON r.userId = ${ownerId}
       AND r.sourceEventId = o.id
       AND r.occurrenceDate = o.occurrenceDate
      WHERE r.id IS NULL
      GROUP BY o.occurrenceDate, o.kind
      ORDER BY o.occurrenceDate ASC, o.kind ASC
    `);
    return rows.map((row) => ({
      occurrenceDate: row.occurrenceDate.toISOString().slice(0, 10),
      kind: row.kind,
      minorUnits: minorUnitsOf(row.total),
      count: Number(row.occurrences),
    }));
  }

  public async listFrom(
    ownerId: number,
    currency: string,
    month: string
  ): Promise<readonly BudgetPeriodState[]> {
    const rows = await this.prisma.budgetPeriod.findMany({
      where: {
        userId: ownerId,
        currency,
        periodStart: { gte: this.periodStart(month) },
      },
      orderBy: [{ periodStart: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => this.toState(row));
  }

  public async recalculate(
    id: number,
    ownerId: number,
    expectedRevision: number,
    values: RecalculatedPeriod
  ): Promise<boolean> {
    const totals = values.closedTotals;
    const result = await this.prisma.budgetPeriod.updateMany({
      where: {
        id,
        userId: ownerId,
        revision: expectedRevision,
        status:
          totals === undefined
            ? BudgetPeriodStatus.OPEN
            : BudgetPeriodStatus.CLOSED,
      },
      data: {
        carryIn: decimalOf(values.carryInMinorUnits),
        revision: { increment: 1 },
        ...(totals === undefined
          ? {}
          : {
              actualIncome: decimalOf(totals.actualIncomeMinorUnits),
              actualExpense: decimalOf(totals.actualExpenseMinorUnits),
              realRemaining: decimalOf(totals.realRemainingMinorUnits),
              correctedAt: new Date(),
            }),
      },
    });
    return result.count === 1;
  }

  public async firstActivityMonth(
    ownerId: number,
    currency: string
  ): Promise<string | null> {
    const first = await this.prisma.oneOffOperationRecord.findFirst({
      where: { userId: ownerId, currency },
      orderBy: [{ operationDate: "asc" }, { id: "asc" }],
      select: { operationDate: true },
    });
    return first?.operationDate.toISOString().slice(0, 7) ?? null;
  }

  public async listClosed(
    ownerId: number,
    currency: string,
    page: PaginationRequest
  ): Promise<CursorPage<BudgetPeriodState>> {
    const context = {
      resource: "budget-period-history",
      scope: `owner:${ownerId}:${currency}`,
    };
    const position =
      page.cursor == null ? null : this.cursors.decode(context, page.cursor);
    if (
      position !== null &&
      (position.length !== 2 ||
        typeof position[0] !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(position[0]) ||
        typeof position[1] !== "number" ||
        !Number.isSafeInteger(position[1]) ||
        position[1] <= 0)
    ) {
      throw invalidPagination();
    }
    const rows = await this.prisma.budgetPeriod.findMany({
      where: {
        userId: ownerId,
        currency,
        status: BudgetPeriodStatus.CLOSED,
        ...(position === null
          ? {}
          : {
              OR: [
                {
                  periodStart: { lt: this.periodStart(position[0] as string) },
                },
                {
                  periodStart: this.periodStart(position[0] as string),
                  id: { lt: position[1] as number },
                },
              ],
            }),
      },
      orderBy: [{ periodStart: "desc" }, { id: "desc" }],
      take: page.limit + 1,
    });
    return createCursorPage(
      rows.map((row) => this.toState(row)),
      page,
      context,
      (period) => [period.month, period.id],
      this.cursors
    );
  }

  public async goalSavings(ownerId: number, currency: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ total: DecimalValue | null }[]>(
      Prisma.sql`
        SELECT SUM(monthlyContribution) AS total
        FROM ObjectifFinancier
        WHERE userId = ${ownerId}
          AND devise = ${currency}
          AND monthlyContribution > 0
          AND savedAmount < montant
      `
    );
    const total = rows[0]?.total;
    return total == null ? 0 : minorUnitsOf(total);
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
    carryIn: DecimalValue;
    unresolvedEvents: number;
    revision: number;
    closedAt: Date | null;
    correctedAt: Date | null;
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
      carryInMinorUnits: minorUnitsOf(row.carryIn),
      unresolvedEvents: row.unresolvedEvents,
      revision: row.revision,
      closedAt: row.closedAt,
      correctedAt: row.correctedAt,
    };
  }

  private periodStart(month: string): Date {
    return new Date(`${monthBounds(month).start}T00:00:00.000Z`);
  }
}
