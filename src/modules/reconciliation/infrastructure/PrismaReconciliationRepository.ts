import {
  Prisma,
  PrismaClient,
  BudgetEnvelope,
  ReconciliationOccurrence,
} from "@prisma/client";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import {
  createCursorPage,
  decodePositiveIntegerCursor,
  paginationCursorCodec,
  PaginationRequest,
} from "../../pagination";
import { personalChargeMinorUnits } from "../../operationsFixes/services/fixedChargeAmounts";
import {
  EnvelopeInput,
  ReconciliationRepository,
  Occurrence,
} from "../application/ReconciliationRepository";
import {
  assertCompatible,
  cents,
  metrics,
  money,
  safe,
  ReconciliationError,
} from "../domain/Reconciliation";
import {
  assertOpen,
  lockReconciliationOwner,
  periodClosed,
} from "./reconciliationLocks";

const date = (month: string) => new Date(`${month}-01T00:00:00Z`);
const monthOf = (value: Date) => value.toISOString().slice(0, 7);
const envelopeDto = (row: BudgetEnvelope) => ({
  id: row.id,
  title: row.title,
  amount: row.amount.toFixed(2),
  currency: row.currency,
  categoryId: row.categoryId,
  startMonth: monthOf(row.startMonth),
  endMonth: row.endMonth ? monthOf(row.endMonth) : null,
  archived: row.archived,
});

export class PrismaReconciliationRepository
  implements ReconciliationRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  private async transaction<T>(
    owner: number,
    action: (tx: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            await lockReconciliationOwner(tx, owner);
            return action(tx);
          },
          { maxWait: 10000, timeout: 20000 }
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034"
        ) {
          if (attempt < 2) continue;
          throw new ReconciliationError("RETRY_CONFLICT");
        }
        throw error;
      }
    }
  }
  private context(owner: number, resource: string, filter = "") {
    return {
      resource: `reconciliation-${resource}`,
      scope: `owner:${owner}:${filter}`,
    };
  }
  private after(
    owner: number,
    resource: string,
    filter: string,
    page: PaginationRequest
  ) {
    const context = this.context(owner, resource, filter);
    const id = decodePositiveIntegerCursor(
      page,
      context,
      paginationCursorCodec
    );
    return { context, where: id === null ? {} : { id: { gt: id } } };
  }
  private page<T extends { id: number }>(
    rows: T[],
    page: PaginationRequest,
    context: ReturnType<PrismaReconciliationRepository["context"]>
  ) {
    return createCursorPage(
      rows,
      page,
      context,
      (row) => [row.id],
      paginationCursorCodec
    );
  }
  private async envelope(
    tx: Prisma.TransactionClient,
    owner: number,
    id: number
  ) {
    const row = await tx.budgetEnvelope.findFirst({
      where: { id, userId: owner },
    });
    if (!row) throw new ReconciliationError("NOT_FOUND");
    return row;
  }
  private async occurrence(
    tx: Prisma.TransactionClient,
    owner: number,
    id: number
  ) {
    const row = await tx.reconciliationOccurrence.findFirst({
      where: { id, userId: owner },
    });
    if (!row) throw new ReconciliationError("NOT_FOUND");
    return row;
  }
  private async operation(
    tx: Prisma.TransactionClient,
    owner: number,
    id: number
  ) {
    const row = await tx.oneOffOperationRecord.findFirst({
      where: { id, userId: owner },
      include: { reconciliation: true },
    });
    if (!row) throw new ReconciliationError("NOT_FOUND");
    return row;
  }
  async listEnvelopes(owner: number, page: PaginationRequest, month?: string) {
    const { context, where } = this.after(
      owner,
      "envelopes",
      month ?? "",
      page
    );
    const rows = await this.prisma.budgetEnvelope.findMany({
      where: {
        userId: owner,
        ...where,
        ...(month
          ? {
              archived: false,
              startMonth: { lte: date(month) },
              OR: [{ endMonth: null }, { endMonth: { gte: date(month) } }],
            }
          : {}),
      },
      orderBy: { id: "asc" },
      take: page.limit + 1,
    });
    return this.page(rows.map(envelopeDto), page, context);
  }
  async getEnvelope(owner: number, id: number) {
    return this.transaction(owner, async (tx) =>
      envelopeDto(await this.envelope(tx, owner, id))
    );
  }
  async saveEnvelope(owner: number, input: EnvelopeInput, id?: number) {
    return this.transaction(owner, async (tx) => {
      if (id !== undefined && (await this.envelope(tx, owner, id)).archived)
        throw new ReconciliationError("ARCHIVED_ENVELOPE");
      if (input.categoryId !== null) {
        const category = await tx.operationCategory.findFirst({
          where: { id: input.categoryId, userId: owner },
        });
        if (!category) throw new ReconciliationError("NOT_FOUND");
        if (category.fixedKind === "REVENU")
          throw new ReconciliationError("INVALID_CATEGORY");
      }
      // Definitions never rewrite existing occurrence snapshots, even in an open month.
      const data = {
        ...input,
        userId: owner,
        startMonth: date(input.startMonth),
        endMonth: input.endMonth ? date(input.endMonth) : null,
      };
      const row =
        id === undefined
          ? await tx.budgetEnvelope.create({ data })
          : await tx.budgetEnvelope.update({ where: { id }, data });
      return envelopeDto(row);
    });
  }
  async archiveEnvelope(owner: number, id: number) {
    await this.transaction(owner, async (tx) => {
      await this.envelope(tx, owner, id);
      await tx.budgetEnvelope.update({
        where: { id },
        data: { archived: true },
      });
    });
  }

  /** First read materializes snapshots once; never invent past forecasts from today's rules. */
  private async materialize(
    tx: Prisma.TransactionClient,
    owner: number,
    month: string,
    currency: string
  ) {
    if (await periodClosed(tx, owner, month, currency, this.today())) return;
    const [envelopes, fixed] = await Promise.all([
      tx.budgetEnvelope.findMany({
        where: {
          userId: owner,
          currency,
          archived: false,
          startMonth: { lte: date(month) },
          OR: [{ endMonth: null }, { endMonth: { gte: date(month) } }],
        },
      }),
      tx.operationFixe.findMany({
        where: { userId: owner, devise: currency, periodicite: "MENSUELLE" },
      }),
    ]);
    const data: Prisma.ReconciliationOccurrenceCreateManyInput[] = [
      ...envelopes.map((row) => ({
        userId: owner,
        month: date(month),
        sourceKey: `ENVELOPE:${row.id}`,
        sourceType: "ENVELOPE" as const,
        envelopeId: row.id,
        title: row.title,
        currency,
        kind: "DEPENSE" as const,
        referenceTotal: row.amount,
        personalShare: "100.00",
        planned: row.amount,
        categoryId: row.categoryId,
      })),
      ...fixed.map((row) => ({
        userId: owner,
        month: date(month),
        sourceKey: `FIXED:${row.idOperationFixe}`,
        sourceType:
          row.typeOperation === "CHARGE"
            ? ("FIXED_EXPENSE" as const)
            : ("FIXED_INCOME" as const),
        fixedSourceId: row.idOperationFixe,
        title: row.titre,
        currency,
        kind:
          row.typeOperation === "CHARGE"
            ? ("DEPENSE" as const)
            : ("ENTREE" as const),
        referenceTotal: row.montant,
        personalShare:
          row.typeOperation === "CHARGE" ? row.pourcentagePersonnel : "100.00",
        planned:
          row.typeOperation === "CHARGE"
            ? money(personalChargeMinorUnits(row))
            : row.montant,
        categoryId: row.categoryId,
      })),
    ];
    // Avoid consuming AUTO_INCREMENT IDs on repeated INSERT IGNORE replays.
    const existing = await tx.reconciliationOccurrence.findMany({
      where: { userId: owner, month: date(month) },
      select: { sourceKey: true },
    });
    const keys = new Set(existing.map((row) => row.sourceKey));
    const missing = data.filter((row) => !keys.has(row.sourceKey));
    if (missing.length)
      await tx.reconciliationOccurrence.createMany({
        data: missing,
        skipDuplicates: true,
      });
  }
  private async dtos(
    tx: Prisma.TransactionClient,
    owner: number,
    rows: ReconciliationOccurrence[]
  ): Promise<Occurrence[]> {
    if (!rows.length) return [];
    // One aggregation per page, independent of the number of linked payments.
    const totals = await tx.$queryRaw<
      { occurrenceId: number; actual: Prisma.Decimal; count: bigint }[]
    >(Prisma.sql`
      SELECT l.occurrenceId, SUM(o.amount) AS actual, COUNT(*) AS count
      FROM ReconciliationLink l JOIN OneOffOperationRecord o ON o.id = l.operationId AND o.userId = l.userId
      WHERE l.userId = ${owner} AND l.occurrenceId IN (${Prisma.join(
      rows.map((r) => r.id)
    )}) GROUP BY l.occurrenceId`);
    const periods = await tx.budgetPeriod.findMany({
      where: {
        userId: owner,
        status: "CLOSED",
        OR: rows.map((r) => ({ periodStart: r.month, currency: r.currency })),
      },
      select: { periodStart: true, currency: true },
    });
    return rows.map((row) => {
      const total = totals.find((t) => t.occurrenceId === row.id);
      return {
        id: row.id,
        month: monthOf(row.month),
        sourceType: row.sourceType,
        sourceId: row.envelopeId ?? row.fixedSourceId!,
        title: row.title,
        currency: row.currency,
        kind: row.kind,
        referenceTotal: row.referenceTotal.toFixed(2),
        personalShare: row.personalShare.toFixed(2),
        categoryId: row.categoryId,
        closed:
          monthOf(row.month) < this.today().slice(0, 7) ||
          periods.some(
            (p) =>
              p.currency === row.currency &&
              p.periodStart.getTime() === row.month.getTime()
          ),
        operationCount: Number(total?.count ?? 0),
        metrics: metrics(
          row.sourceType,
          cents(row.planned.toFixed(2)),
          total ? cents(total.actual.toFixed(2)) : 0
        ),
      };
    });
  }
  async listOccurrences(
    owner: number,
    month: string,
    currency: string,
    page: PaginationRequest
  ) {
    const { context, where } = this.after(
      owner,
      "occurrences",
      `${month}:${currency}`,
      page
    );
    return this.transaction(owner, async (tx) => {
      await this.materialize(tx, owner, month, currency);
      const rows = await tx.reconciliationOccurrence.findMany({
        where: { userId: owner, month: date(month), currency, ...where },
        orderBy: { id: "asc" },
        take: page.limit + 1,
      });
      return this.page(await this.dtos(tx, owner, rows), page, context);
    });
  }
  async getOccurrence(owner: number, id: number) {
    return this.transaction(
      owner,
      async (tx) =>
        (await this.dtos(tx, owner, [await this.occurrence(tx, owner, id)]))[0]
    );
  }
  async updateOccurrence(owner: number, id: number, planned: string) {
    return this.transaction(owner, async (tx) => {
      const row = await this.occurrence(tx, owner, id);
      await assertOpen(
        tx,
        owner,
        monthOf(row.month),
        row.currency,
        this.today()
      );
      const updated = await tx.reconciliationOccurrence.update({
        where: { id },
        data: { planned },
      });
      return (await this.dtos(tx, owner, [updated]))[0];
    });
  }
  async listOperations(
    owner: number,
    id: number,
    unassociated: boolean,
    page: PaginationRequest
  ) {
    const { context, where } = this.after(
      owner,
      "operations",
      `${id}:${unassociated}`,
      page
    );
    return this.transaction(owner, async (tx) => {
      const occurrence = await this.occurrence(tx, owner, id);
      const start = occurrence.month;
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
      );
      const rows = await tx.oneOffOperationRecord.findMany({
        where: {
          userId: owner,
          ...where,
          ...(unassociated
            ? {
                currency: occurrence.currency,
                type: occurrence.kind,
                operationDate: { gte: start, lt: end },
                reconciliation: { is: null },
              }
            : { reconciliation: { is: { occurrenceId: id, userId: owner } } }),
        },
        orderBy: { id: "asc" },
        take: page.limit + 1,
        include: { reconciliation: true },
      });
      return this.page(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          amount: row.amount.toFixed(2),
          currency: row.currency,
          type: row.type,
          operationDate: row.operationDate.toISOString().slice(0, 10),
          categoryId: row.categoryId,
          occurrenceId: row.reconciliation?.occurrenceId ?? null,
        })),
        page,
        context
      );
    });
  }
  async getLink(owner: number, operationId: number) {
    return this.transaction(owner, async (tx) => {
      const operation = await this.operation(tx, owner, operationId);
      return {
        operationId,
        occurrenceId: operation.reconciliation?.occurrenceId ?? null,
      };
    });
  }
  async link(
    owner: number,
    operationId: number,
    occurrenceId: number | null,
    expectedOccurrenceId: number | null
  ) {
    await this.transaction(owner, async (tx) => {
      const operation = await this.operation(tx, owner, operationId);
      const current = operation.reconciliation?.occurrenceId ?? null;
      const destination =
        occurrenceId === null
          ? null
          : await this.occurrence(tx, owner, occurrenceId);
      // Read-only replay is safe even after closure. Stale commands never overwrite a different assignment.
      if (current === occurrenceId) return;
      if (current !== expectedOccurrenceId)
        throw new ReconciliationError("ASSOCIATION_CONFLICT");
      if (current !== null) {
        const previous = await this.occurrence(tx, owner, current);
        await assertOpen(
          tx,
          owner,
          monthOf(previous.month),
          previous.currency,
          this.today()
        );
      }
      if (destination) {
        await assertOpen(
          tx,
          owner,
          monthOf(destination.month),
          destination.currency,
          this.today()
        );
        assertCompatible(
          {
            month: monthOf(destination.month),
            currency: destination.currency,
            kind: destination.kind,
          },
          {
            operationDate: operation.operationDate.toISOString().slice(0, 10),
            currency: operation.currency,
            kind: operation.type,
          }
        );
        await tx.reconciliationLink.upsert({
          where: { operationId },
          create: { operationId, userId: owner, occurrenceId: destination.id },
          update: { occurrenceId: destination.id },
        });
      } else
        await tx.reconciliationLink.deleteMany({
          where: { operationId, userId: owner },
        });
    });
  }
  async suggestions(
    owner: number,
    operationId: number,
    page: PaginationRequest
  ) {
    const { context, where } = this.after(
      owner,
      "suggestions",
      String(operationId),
      page
    );
    return this.transaction(owner, async (tx) => {
      const operation = await this.operation(tx, owner, operationId);
      const month = monthOf(operation.operationDate);
      await this.materialize(tx, owner, month, operation.currency);
      const closed = await periodClosed(
        tx,
        owner,
        month,
        operation.currency,
        this.today()
      );
      const rows = closed
        ? []
        : await tx.reconciliationOccurrence.findMany({
            where: {
              userId: owner,
              month: date(month),
              currency: operation.currency,
              kind: operation.type,
              categoryId: operation.categoryId,
              ...where,
            },
            orderBy: { id: "asc" },
            take: page.limit + 1,
          });
      return this.page(await this.dtos(tx, owner, rows), page, context);
    });
  }
  async summary(owner: number, month: string, currency: string) {
    return this.transaction(owner, async (tx) => {
      await this.materialize(tx, owner, month, currency);
      const end = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)
      );
      const actual = await tx.$queryRaw<
        { kind: string; total: Prisma.Decimal; unassociated: Prisma.Decimal }[]
      >(Prisma.sql`
        SELECT o.type AS kind, SUM(o.amount) AS total,
          SUM(CASE WHEN l.operationId IS NULL THEN o.amount ELSE 0 END) AS unassociated
        FROM OneOffOperationRecord o LEFT JOIN ReconciliationLink l ON l.operationId = o.id AND l.userId = o.userId
        WHERE o.userId = ${owner} AND o.currency = ${currency} AND o.operationDate >= ${date(
        month
      )} AND o.operationDate < ${end}
        GROUP BY o.type`);
      const tracked = await tx.$queryRaw<
        { kind: string; planned: Prisma.Decimal; projected: Prisma.Decimal }[]
      >(Prisma.sql`
        SELECT c.kind, SUM(c.planned) AS planned, SUM(GREATEST(c.planned, COALESCE(a.actual, 0))) AS projected
        FROM ReconciliationOccurrence c LEFT JOIN (
          SELECT l.occurrenceId, SUM(o.amount) AS actual FROM ReconciliationLink l
          JOIN OneOffOperationRecord o ON o.id = l.operationId AND o.userId = l.userId
          JOIN ReconciliationOccurrence r ON r.id = l.occurrenceId AND r.userId = l.userId
          WHERE l.userId = ${owner} AND r.month = ${date(
        month
      )} AND r.currency = ${currency}
          GROUP BY l.occurrenceId
        ) a ON a.occurrenceId = c.id
        WHERE c.userId = ${owner} AND c.month = ${date(
        month
      )} AND c.currency = ${currency} GROUP BY c.kind`);
      const amounts = (kind: string) => {
        const a = actual.find((r) => r.kind === kind);
        const t = tracked.find((r) => r.kind === kind);
        const unassociated = a ? cents(a.unassociated.toFixed(2)) : 0;
        return {
          actual: a ? money(cents(a.total.toFixed(2))) : "0.00",
          unassociated: money(unassociated),
          planned: t ? money(cents(t.planned.toFixed(2))) : "0.00",
          projected: money(
            safe(unassociated + (t ? cents(t.projected.toFixed(2)) : 0))
          ),
        };
      };
      const income = amounts("ENTREE"),
        expense = amounts("DEPENSE");
      return {
        month,
        currency,
        closed: await periodClosed(tx, owner, month, currency, this.today()),
        scope: "TRACKED_OCCURRENCES_AND_UNASSOCIATED_ACTUALS" as const,
        actualIncome: income.actual,
        actualExpense: expense.actual,
        unassociatedIncome: income.unassociated,
        unassociatedExpense: expense.unassociated,
        trackedPlannedIncome: income.planned,
        trackedPlannedExpense: expense.planned,
        projectedIncome: income.projected,
        projectedExpense: expense.projected,
      };
    });
  }
  async eligibility(owner: number, page: PaginationRequest) {
    const { context, where } = this.after(owner, "fixed-eligibility", "", page);
    // Fixed IDs use their legacy column name.
    const afterId = "id" in where ? where.id : undefined;
    const rows = await this.prisma.operationFixe.findMany({
      where: {
        userId: owner,
        ...(afterId ? { idOperationFixe: afterId } : {}),
      },
      orderBy: { idOperationFixe: "asc" },
      take: page.limit + 1,
    });
    return this.page(
      rows.map((row) => ({
        id: row.idOperationFixe,
        title: row.titre,
        currency: row.devise,
        periodicity: row.periodicite,
        eligible: row.periodicite === "MENSUELLE" && row.devise !== null,
        reason:
          row.periodicite !== "MENSUELLE"
            ? "NON_MONTHLY_WITHOUT_DUE_DATE"
            : row.devise === null
            ? "MISSING_CURRENCY"
            : "ELIGIBLE",
      })),
      page,
      context
    );
  }
}
