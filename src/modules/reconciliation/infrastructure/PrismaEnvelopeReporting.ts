import { Prisma, PrismaClient } from "@prisma/client";
import {
  paginationCursorCodec,
  decodePositiveIntegerCursor,
  createCursorPage,
  PaginationRequest,
  CursorPage,
} from "../../pagination";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import {
  effectiveFixedRows,
  monthDate,
  snapshotOf,
} from "../../operationsFixes/infrastructure/fixedVersions";
import { chargeAmountFields } from "../../operationsFixes/services/fixedChargeAmounts";
import {
  analyzeEnvelopeMonths,
  EnvelopeMonth,
} from "../domain/EnvelopeAnalysis";
import { cents, metrics, money, safe } from "../domain/Reconciliation";
import {
  EnvelopeReportingRepository,
  ReportingQuery,
} from "../application/EnvelopeReportingRepository";
import { PrismaReconciliationRepository } from "./PrismaReconciliationRepository";
export class PrismaEnvelopeReporting implements EnvelopeReportingRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}
  private context(
    owner: number,
    resource: string,
    query: ReportingQuery | string
  ) {
    return {
      resource: `envelope-${resource}`,
      scope: `owner:${owner}:${
        typeof query === "string"
          ? query
          : `${query.from}:${query.to}:${query.currency}`
      }`,
    };
  }
  private async initialize(owner: number, query: ReportingQuery) {
    const current = this.today().slice(0, 7);
    // No reconstruction of past forecasts or creation of future months by annual analytics.
    if (query.from <= current && query.to >= current)
      await new PrismaReconciliationRepository(
        this.db,
        this.today
      ).listOccurrences(owner, current, query.currency, {
        limit: 1,
        cursor: null,
      });
  }
  private async category(owner: number, ids: number[]) {
    return this.db.operationCategory.findMany({
      where: { userId: owner, id: { in: ids } },
      select: { id: true, name: true, color: true, icon: true },
    });
  }
  async overview(
    owner: number,
    query: ReportingQuery,
    page: PaginationRequest
  ): Promise<CursorPage<Record<string, unknown>>> {
    const context = this.context(owner, "overview", query);
    const after = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    await this.initialize(owner, query);
    const sources = await this.db.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT DISTINCT fixedSourceId AS id FROM ReconciliationOccurrence
    WHERE userId = ${owner} AND currency = ${
      query.currency
    } AND sourceType = 'ENVELOPE' AND fixedSourceId IS NOT NULL
      AND month >= ${monthDate(query.from)} AND month <= ${monthDate(query.to)}
      ${
        after === null ? Prisma.empty : Prisma.sql`AND fixedSourceId > ${after}`
      }
    ORDER BY id ASC LIMIT ${page.limit + 1}`);
    const ids = sources.map((s) => s.id);
    if (!ids.length)
      return createCursorPage(
        [],
        page,
        context,
        (r: { id: number }) => [r.id],
        paginationCursorCodec
      );
    const rows = await this.db.reconciliationOccurrence.findMany({
      where: {
        userId: owner,
        currency: query.currency,
        sourceType: "ENVELOPE",
        fixedSourceId: { in: ids },
        month: { gte: monthDate(query.from), lte: monthDate(query.to) },
      },
      orderBy: [{ month: "asc" }, { id: "asc" }],
    });
    const occurrenceIds = rows.map((r) => r.id);
    const [totals, preview, categories] = await Promise.all([
      this.db.$queryRaw<
        { occurrenceId: number; actual: Prisma.Decimal; count: bigint }[]
      >(Prisma.sql`
    SELECT l.occurrenceId, SUM(o.amount) AS actual, COUNT(*) AS count FROM ReconciliationLink l
    JOIN OneOffOperationRecord o ON o.id = l.operationId AND o.userId = l.userId
    WHERE l.userId = ${owner} AND l.occurrenceId IN (${Prisma.join(
        occurrenceIds
      )}) GROUP BY l.occurrenceId`),
      this.db.$queryRaw<
        {
          occurrenceId: number;
          id: number;
          title: string;
          amount: Prisma.Decimal;
          operationDate: Date;
        }[]
      >(Prisma.sql`
    SELECT occurrenceId, id, title, amount, operationDate FROM (
     SELECT l.occurrenceId, o.id, o.title, o.amount, o.operationDate,
       ROW_NUMBER() OVER (PARTITION BY l.occurrenceId ORDER BY o.operationDate DESC, o.id DESC) AS position
     FROM ReconciliationLink l JOIN OneOffOperationRecord o ON o.id = l.operationId AND o.userId = l.userId
     WHERE l.userId = ${owner} AND l.occurrenceId IN (${Prisma.join(
        occurrenceIds
      )})
    ) ranked WHERE position <= 3 ORDER BY occurrenceId, operationDate DESC, id DESC`),
      this.category(
        owner,
        rows.flatMap((r) => (r.categoryId === null ? [] : [r.categoryId]))
      ),
    ]);
    const data = ids.map((id) => {
      const monthly = rows.filter((r) => r.fixedSourceId === id);
      const months = monthly.map((row) => {
        const total = totals.find((t) => t.occurrenceId === row.id);
        const actual = total ? cents(total.actual.toFixed(2)) : 0;
        return {
          occurrenceId: row.id,
          month: row.month.toISOString().slice(0, 7),
          categoryId: row.categoryId,
          ...metrics("ENVELOPE", cents(row.planned.toFixed(2)), actual),
          operationCount: Number(total?.count ?? 0),
          paymentsPreview: preview
            .filter((p) => p.occurrenceId === row.id)
            .map((p) => ({
              id: p.id,
              title: p.title,
              amount: p.amount.toFixed(2),
              operationDate: p.operationDate.toISOString().slice(0, 10),
            })),
          paymentsPath: `/reconciliation/occurrences/${row.id}/operations`,
        };
      });
      const latest = monthly.at(-1)!;
      const plannedTotal = months.reduce(
        (sum, m) => safe(sum + cents(m.planned)),
        0
      );
      const actualTotal = months.reduce(
        (sum, m) => safe(sum + cents(m.actual)),
        0
      );
      return {
        id,
        totals: {
          ...metrics("ENVELOPE", plannedTotal, actualTotal),
          observedMonths: months.length,
          operationCount: months.reduce((sum, m) => sum + m.operationCount, 0),
          sumMonthlyOverrun: money(
            months.reduce((sum, m) => safe(sum + cents(m.overrun)), 0)
          ),
        },
        title: latest.title,
        currency: query.currency,
        category: categories.find((c) => c.id === latest.categoryId) ?? null,
        months,
        statistics: analyzeEnvelopeMonths(months, this.today().slice(0, 7)),
      };
    });
    return createCursorPage(
      data,
      page,
      context,
      (r) => [r.id],
      paginationCursorCodec
    );
  }
  async analytics(
    owner: number,
    query: ReportingQuery,
    page: PaginationRequest
  ) {
    const context = this.context(owner, "categories", query);
    // Category ID 0 denotes uncategorized; cursor stores ID+1, preserving positive-ID codec.
    const position = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    const after = position === null ? null : position - 1;
    await this.initialize(owner, query);
    const categoryPage = await this.db.$queryRaw<
      { id: bigint | number }[]
    >(Prisma.sql`
      SELECT DISTINCT COALESCE(categoryId,0) AS id FROM ReconciliationOccurrence
      WHERE userId = ${owner} AND currency = ${
      query.currency
    } AND sourceType = 'ENVELOPE' AND fixedSourceId IS NOT NULL
        AND month >= ${monthDate(query.from)} AND month <= ${monthDate(
      query.to
    )}
        ${
          after === null
            ? Prisma.empty
            : Prisma.sql`AND COALESCE(categoryId,0) > ${after}`
        }
      ORDER BY id ASC LIMIT ${page.limit + 1}`);
    const ids = categoryPage.map((row) => Number(row.id));
    if (!ids.length)
      return {
        data: [],
        meta: { limit: page.limit, hasNext: false, nextCursor: null },
      };
    const groups = await this.db.$queryRaw<
      {
        categoryId: number;
        month: Date;
        planned: Prisma.Decimal;
        actual: Prisma.Decimal;
        operationCount: bigint;
        emptyEnvelopes: bigint;
      }[]
    >(Prisma.sql`
   SELECT COALESCE(c.categoryId,0) AS categoryId, c.month, SUM(c.planned) AS planned,
     SUM(COALESCE(a.actual,0)) AS actual, SUM(COALESCE(a.operationCount,0)) AS operationCount,
     SUM(CASE WHEN a.operationCount IS NULL THEN 1 ELSE 0 END) AS emptyEnvelopes
   FROM ReconciliationOccurrence c LEFT JOIN (
    SELECT l.occurrenceId, SUM(o.amount) AS actual, COUNT(*) AS operationCount FROM ReconciliationLink l
    JOIN OneOffOperationRecord o ON o.id = l.operationId AND o.userId = l.userId
    JOIN ReconciliationOccurrence r ON r.id = l.occurrenceId AND r.userId = l.userId
    WHERE l.userId = ${owner} AND r.month >= ${monthDate(
      query.from
    )} AND r.month <= ${monthDate(query.to)} AND r.currency = ${query.currency}
    GROUP BY l.occurrenceId
   ) a ON a.occurrenceId = c.id
   WHERE c.userId = ${owner} AND c.currency = ${
      query.currency
    } AND c.sourceType = 'ENVELOPE' AND c.fixedSourceId IS NOT NULL
    AND c.month >= ${monthDate(query.from)} AND c.month <= ${monthDate(
      query.to
    )}
    AND COALESCE(c.categoryId,0) IN (${Prisma.join(ids)})
   GROUP BY c.categoryId, c.month ORDER BY categoryId ASC, c.month ASC`);
    const categories = await this.category(owner, ids);
    const data = ids.map((id) => {
      const months = groups
        .filter((g) => Number(g.categoryId) === id)
        .map((g) => ({
          month: g.month.toISOString().slice(0, 7),
          planned: money(safe(cents(g.planned.toFixed(2)))),
          actual: money(safe(cents(g.actual.toFixed(2)))),
          operationCount: Number(g.operationCount),
          unreconciledEnvelopes: Number(g.emptyEnvelopes),
        }));
      // A partially reconciled category-month is excluded rather than understated.
      const sample: EnvelopeMonth[] = months.map((m) => ({
        ...m,
        operationCount: m.unreconciledEnvelopes > 0 ? 0 : m.operationCount,
      }));
      return {
        id,
        category: categories.find((c) => c.id === id) ?? null,
        months,
        statistics: analyzeEnvelopeMonths(sample, this.today().slice(0, 7)),
      };
    });
    return createCursorPage(
      data,
      page,
      context,
      (r) => [r.id + 1],
      paginationCursorCodec
    );
  }
  async fixedMonth(owner: number, month: string, page: PaginationRequest) {
    const context = this.context(owner, "fixed-month", month);
    const after = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    const rows = (await effectiveFixedRows(this.db, owner, month))
      .filter((r) => after === null || r.idOperationFixe > after)
      .sort((a, b) => a.idOperationFixe - b.idOperationFixe)
      .slice(0, page.limit + 1);
    const data = rows.map((row) => {
      const s = snapshotOf(row);
      return {
        id: row.idOperationFixe,
        idOperationFixe: row.idOperationFixe,
        titre: s.titre,
        montant: new Prisma.Decimal(s.montant).toFixed(2),
        devise: s.devise,
        typeOperation: row.typeOperation,
        categoryId: s.categoryId,
        category: s.category,
        ...(row.typeOperation === "CHARGE"
          ? { ...chargeAmountFields(s), isBudgetEnvelope: s.isBudgetEnvelope }
          : {}),
      };
    });
    return createCursorPage(
      data,
      page,
      context,
      (r) => [r.id],
      paginationCursorCodec
    );
  }
}
