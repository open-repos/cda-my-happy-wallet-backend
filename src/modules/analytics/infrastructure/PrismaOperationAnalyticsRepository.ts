import { Prisma, PrismaClient } from "@prisma/client";
import { OperationAnalyticsRepository } from "../application/OperationAnalyticsUseCases";
import {
  AnalyticsCategory,
  AnalyticsGroupBy,
  AnalyticsQuery,
  AnalyticsRow,
  AnalyticsSplitBy,
  OperationKind,
} from "../domain";

type DecimalValue = { toFixed(fractionDigits: number): string };

const centsOf = (value: DecimalValue): number => {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value.toFixed(2));
  if (match == null) throw new Error("INVALID_PERSISTED_AMOUNT");
  const magnitude = Number(match[2]) * 100 + Number(match[3]);
  const signed = match[1] === "-" ? -magnitude : magnitude;
  if (!Number.isSafeInteger(signed))
    throw new Error("INVALID_PERSISTED_AMOUNT");
  return signed;
};

/**
 * Expressions SQL fixes par dimension : aucune valeur de requête n'est
 * interpolée dans le SQL brut. Les semaines ISO sont libellées par leur lundi
 * (`WEEKDAY` vaut 0 le lundi).
 */
const DIMENSION_SQL: Record<AnalyticsGroupBy | AnalyticsSplitBy, Prisma.Sql> = {
  day: Prisma.sql`DATE_FORMAT(o.operationDate, '%Y-%m-%d')`,
  week: Prisma.sql`DATE_FORMAT(DATE_SUB(o.operationDate, INTERVAL WEEKDAY(o.operationDate) DAY), '%Y-%m-%d')`,
  month: Prisma.sql`DATE_FORMAT(o.operationDate, '%Y-%m')`,
  year: Prisma.sql`DATE_FORMAT(o.operationDate, '%Y')`,
  category: Prisma.sql`CAST(o.categoryId AS CHAR)`,
  kind: Prisma.sql`CAST(o.type AS CHAR)`,
};

/** Requête d'agrégat, exposée pour vérifier son plan d'exécution en test. */
export const analyticsSql = (
  ownerId: number,
  query: AnalyticsQuery
): Prisma.Sql => {
  const bucket = DIMENSION_SQL[query.groupBy];
  const series =
    query.splitBy === null ? Prisma.sql`NULL` : DIMENSION_SQL[query.splitBy];
  const kindFilter =
    query.kind === null ? Prisma.empty : Prisma.sql`AND o.type = ${query.kind}`;
  // Index (userId, currency, operationDate, id) : balayage borné à la période.
  return Prisma.sql`
      SELECT ${bucket} AS bucket, ${series} AS series, o.type AS kind,
             SUM(o.amount) AS total, COUNT(*) AS operations
      FROM OneOffOperationRecord o
      WHERE o.userId = ${ownerId}
        AND o.currency = ${query.currency}
        AND o.operationDate >= STR_TO_DATE(${query.from}, '%Y-%m-%d')
        AND o.operationDate <= STR_TO_DATE(${query.to}, '%Y-%m-%d')
        ${kindFilter}
      GROUP BY bucket, series, kind
    `;
};

export class PrismaOperationAnalyticsRepository
  implements OperationAnalyticsRepository
{
  public constructor(private readonly prisma: PrismaClient) {}

  public async aggregate(
    ownerId: number,
    query: AnalyticsQuery
  ): Promise<AnalyticsRow[]> {
    const rows = await this.prisma.$queryRaw<
      {
        bucket: string;
        series: string | null;
        kind: OperationKind;
        total: DecimalValue;
        operations: bigint | number;
      }[]
    >(analyticsSql(ownerId, query));
    return rows.map((row) => ({
      bucket: row.bucket,
      series: row.series,
      kind: row.kind,
      cents: centsOf(row.total),
      count: Number(row.operations),
    }));
  }

  public async categories(
    ownerId: number,
    ids: readonly number[]
  ): Promise<AnalyticsCategory[]> {
    return this.prisma.operationCategory.findMany({
      where: { userId: ownerId, id: { in: [...ids] } },
      select: { id: true, name: true, color: true },
    });
  }
}
