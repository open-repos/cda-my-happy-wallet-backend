import { Prisma, PrismaClient } from "@prisma/client";
import { BudgetPeriodEngine } from "../../budgetPeriods/application/BudgetPeriodEngine";
import { PrismaBudgetPeriodRepository } from "../../budgetPeriods/infrastructure/PrismaBudgetPeriodRepository";
import {
  createCursorPage,
  invalidPagination,
  paginationCursorCodec,
  PaginationRequest,
} from "../../pagination";
import { isCivilDate } from "../domain/Savings";
import { monthBounds } from "../../budgetPeriods/domain/BudgetPeriod";

export class PrismaCurrentAccount {
  public constructor(private readonly prisma: PrismaClient) {}
  public async summary(
    owner: number,
    month: string,
    currency: string,
    today: string
  ) {
    const { budget, carryFromMonth } = await new BudgetPeriodEngine(
      new PrismaBudgetPeriodRepository(
        this.prisma,
        paginationCursorCodec,
        () => today
      )
    ).summarize(owner, month, currency, today);
    return {
      type: "CURRENT" as const,
      month,
      currency,
      balanceMinorUnits: budget.realRemainingMinorUnits,
      balanceBasis: "AVAILABLE_BUDGET" as const,
      carryFromMonth,
      budget,
    };
  }
  public async history(
    owner: number,
    month: string,
    currency: string,
    page: PaginationRequest
  ) {
    const context = {
      resource: "current-account-history",
      scope: `owner:${owner}:${month}:${currency}`,
    };
    const position =
      page.cursor === null
        ? null
        : paginationCursorCodec.decode(context, page.cursor);
    if (
      position !== null &&
      (position.length !== 3 ||
        typeof position[0] !== "string" ||
        !isCivilDate(position[0]) ||
        ![0, 1, 2].includes(position[1] as number) ||
        typeof position[2] !== "number" ||
        !Number.isSafeInteger(position[2]) ||
        position[2] <= 0)
    )
      throw invalidPagination();
    const bounds = monthBounds(month);
    const start = new Date(`${bounds.start}T00:00:00Z`),
      end = new Date(`${bounds.end}T00:00:00Z`);
    const after =
      position === null
        ? Prisma.empty
        : Prisma.sql`WHERE operationDate < ${new Date(
            `${position[0]}T00:00:00Z`
          )}
      OR (operationDate = ${new Date(
        `${position[0]}T00:00:00Z`
      )} AND source > ${position[1]})
      OR (operationDate = ${new Date(
        `${position[0]}T00:00:00Z`
      )} AND source = ${position[1]} AND id < ${position[2]})`;
    const rows = await this.prisma.$queryRaw<
      {
        id: number;
        source: number;
        operationDate: Date;
        title: string;
        kind: string;
        signedAmount: Prisma.Decimal;
        accountId: number | null;
      }[]
    >(Prisma.sql`
      SELECT * FROM (
        SELECT id, 0 AS source, operationDate, title, type AS kind,
          CASE WHEN type = 'ENTREE' THEN amount * 100 ELSE -amount * 100 END AS signedAmount, NULL AS accountId
        FROM OneOffOperationRecord WHERE userId = ${owner} AND currency = ${currency} AND operationDate BETWEEN ${start} AND ${end}
        UNION ALL
        SELECT m.id, 1 AS source, m.operationDate, a.name AS title, 'VIREMENT' AS kind,
          CASE WHEN m.direction = 'FROM_SAVINGS' THEN m.amountMinorUnits ELSE -m.amountMinorUnits END AS signedAmount, m.accountId
        FROM SavingsMovement m JOIN SavingsAccount a ON a.id = m.accountId AND a.userId = m.userId
        WHERE m.userId = ${owner} AND m.currency = ${currency} AND m.operationDate BETWEEN ${start} AND ${end}
        UNION ALL
        SELECT id, 2 AS source, operationDate, 'Entrée exceptionnelle' AS title, 'ENTREE' AS kind,
          exceptionalIncomeMinorUnits AS signedAmount, NULL AS accountId
        FROM MonthEndDecision WHERE userId = ${owner} AND currency = ${currency}
          AND operationDate BETWEEN ${start} AND ${end} AND exceptionalIncomeMinorUnits > 0
      ) history ${after}
      ORDER BY operationDate DESC, source ASC, id DESC LIMIT ${page.limit + 1}
    `);
    const items = rows.map((row) => ({
      id: row.id,
      source: Number(row.source),
      operationDate: row.operationDate.toISOString().slice(0, 10),
      title: row.title,
      kind: row.kind,
      signedAmountMinorUnits: Number(row.signedAmount),
      accountId: row.accountId,
      currency,
    }));
    const result = createCursorPage(
      items,
      page,
      context,
      (row) => [row.operationDate, row.source, row.id],
      paginationCursorCodec
    );
    return {
      ...result,
      data: result.data.map((row) => ({
        ...row,
        source:
          row.source === 0
            ? "OPERATION"
            : row.source === 1
            ? "VIREMENT"
            : "EXCEPTIONAL_INCOME",
      })),
    };
  }
}
