import {
  MonthlyEventKind,
  OccurrenceResolutionStatus,
  Prisma,
  PrismaClient,
  TypeOperationEnum,
} from "@prisma/client";
import { OneOffOperation } from "../../operations/domain";
import {
  createCursorPage,
  CursorPage,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";
import {
  OccurrenceResolutionConflict,
  OccurrenceResolutionRepository,
} from "../application";
import {
  OccurrenceResolution,
  OccurrenceSnapshot,
  PendingOccurrence,
} from "../domain";

type DecimalValue = { toFixed(fractionDigits: number): string };

type ResolutionRow = Readonly<{
  id: number;
  userId: number;
  sourceEventId: number;
  occurrenceDate: Date;
  status: OccurrenceResolutionStatus;
  title: string;
  amount: DecimalValue;
  currency: string;
  kind: MonthlyEventKind;
  resolvedAt: Date;
  operation: Readonly<{
    id: number;
    title: string;
    amount: DecimalValue;
    operationDate: Date;
    categoryId: number;
  }> | null;
}>;

const operationSelect = {
  select: {
    id: true,
    title: true,
    amount: true,
    operationDate: true,
    categoryId: true,
  },
} as const;

const minorUnitsOf = (value: DecimalValue): number =>
  Math.round(Number(value.toFixed(2)) * 100);
const decimalOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);
const dateOf = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const civilDateOf = (value: Date): string => value.toISOString().slice(0, 10);

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export class PrismaOccurrenceResolutionRepository
  implements OccurrenceResolutionRepository
{
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {}

  public async listPending(
    ownerId: number,
    from: string,
    through: string,
    page: PaginationRequest
  ): Promise<CursorPage<PendingOccurrence>> {
    const context = {
      resource: "pending-event-occurrences",
      scope: `owner:${ownerId}:${from}:${through}`,
    };
    const position =
      page.cursor == null ? null : this.cursors.decode(context, page.cursor);
    if (
      position !== null &&
      (position.length !== 2 ||
        typeof position[0] !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(position[0]) ||
        typeof position[1] !== "number" ||
        !Number.isSafeInteger(position[1]) ||
        position[1] <= 0)
    ) {
      throw invalidPagination();
    }
    const cursor =
      position === null
        ? Prisma.empty
        : Prisma.sql`AND (o.occurrenceDate > STR_TO_DATE(${position[0]}, '%Y-%m-%d') OR (o.occurrenceDate = STR_TO_DATE(${position[0]}, '%Y-%m-%d') AND o.id > ${position[1]}))`;
    // Au plus 12 mois générés; chaque règle produit au plus une occurrence par mois.
    const rows = await this.prisma.$queryRaw<
      {
        id: number;
        title: string;
        amount: DecimalValue;
        currency: string;
        kind: MonthlyEventKind;
        occurrenceDate: Date;
      }[]
    >(Prisma.sql`
      WITH RECURSIVE months (monthStart) AS (
        SELECT STR_TO_DATE(${from}, '%Y-%m-%d')
        UNION ALL
        SELECT DATE_ADD(monthStart, INTERVAL 1 MONTH) FROM months
        WHERE monthStart < DATE_FORMAT(STR_TO_DATE(${through}, '%Y-%m-%d'), '%Y-%m-01')
      )
      SELECT o.id, o.title, o.amount, o.currency, o.kind, o.occurrenceDate
      FROM (
        SELECT e.id, e.titre AS title, e.montant AS amount, e.devise AS currency,
               e.kind, e.startDate, e.endDate,
               DATE_ADD(m.monthStart, INTERVAL LEAST(DAY(e.startDate), DAY(LAST_DAY(m.monthStart))) - 1 DAY) AS occurrenceDate
        FROM months m
        JOIN EvenementMensuel e
          ON e.userId = ${ownerId}
         AND e.startDate <= LAST_DAY(m.monthStart)
         AND (
           (e.recurrence = 'AUCUNE' AND e.startDate >= m.monthStart)
           OR e.recurrence = 'MENSUELLE'
         )
      ) o
      LEFT JOIN EventOccurrenceResolution r
        ON r.userId = ${ownerId}
       AND r.sourceEventId = o.id
       AND r.occurrenceDate = o.occurrenceDate
      WHERE r.id IS NULL
        AND o.occurrenceDate BETWEEN STR_TO_DATE(${from}, '%Y-%m-%d') AND STR_TO_DATE(${through}, '%Y-%m-%d')
        AND o.occurrenceDate >= o.startDate
        AND (o.endDate IS NULL OR o.occurrenceDate <= o.endDate)
        ${cursor}
      ORDER BY o.occurrenceDate ASC, o.id ASC
      LIMIT ${page.limit + 1}
    `);
    return createCursorPage(
      rows.map((row) => ({
        sourceEventId: row.id,
        occurrenceDate: civilDateOf(row.occurrenceDate),
        title: row.title,
        minorUnits: minorUnitsOf(row.amount),
        currency: row.currency,
        kind: row.kind,
      })),
      page,
      context,
      (item) => [item.occurrenceDate, item.sourceEventId],
      this.cursors
    );
  }

  public async find(
    ownerId: number,
    sourceEventId: number,
    occurrenceDate: string
  ): Promise<OccurrenceResolution | null> {
    const row = await this.prisma.eventOccurrenceResolution.findUnique({
      where: {
        userId_sourceEventId_occurrenceDate: {
          userId: ownerId,
          sourceEventId,
          occurrenceDate: dateOf(occurrenceDate),
        },
      },
      include: { operation: operationSelect },
    });
    return row == null ? null : this.toDomain(row);
  }

  public async realize(
    snapshot: OccurrenceSnapshot,
    operation: OneOffOperation
  ): Promise<OccurrenceResolution> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.oneOffOperationRecord.create({
          data: {
            title: operation.title,
            amount: decimalOf(operation.money.minorUnits),
            currency: operation.money.currency,
            type:
              operation.kind === "ENTREE"
                ? TypeOperationEnum.ENTREE
                : TypeOperationEnum.DEPENSE,
            operationDate: dateOf(operation.operationDate),
            userId: operation.ownerId,
            categoryId: operation.categoryId,
          },
        });
        return tx.eventOccurrenceResolution.create({
          data: {
            ...this.snapshotData(snapshot),
            status: OccurrenceResolutionStatus.REALIZED,
            operationId: created.id,
          },
          include: { operation: operationSelect },
        });
      });
      return this.toDomain(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw new OccurrenceResolutionConflict();
      throw error;
    }
  }

  public async cancel(
    snapshot: OccurrenceSnapshot
  ): Promise<OccurrenceResolution> {
    try {
      return this.toDomain(
        await this.prisma.eventOccurrenceResolution.create({
          data: {
            ...this.snapshotData(snapshot),
            status: OccurrenceResolutionStatus.CANCELED,
          },
          include: { operation: operationSelect },
        })
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new OccurrenceResolutionConflict();
      throw error;
    }
  }

  private snapshotData(snapshot: OccurrenceSnapshot) {
    return {
      userId: snapshot.ownerId,
      sourceEventId: snapshot.sourceEventId,
      occurrenceDate: dateOf(snapshot.occurrenceDate),
      title: snapshot.title,
      amount: decimalOf(snapshot.minorUnits),
      currency: snapshot.currency,
      kind: snapshot.kind,
    };
  }

  private toDomain(row: ResolutionRow): OccurrenceResolution {
    return {
      id: row.id,
      ownerId: row.userId,
      sourceEventId: row.sourceEventId,
      occurrenceDate: civilDateOf(row.occurrenceDate),
      status: row.status,
      title: row.title,
      minorUnits: minorUnitsOf(row.amount),
      currency: row.currency,
      kind: row.kind,
      resolvedAt: row.resolvedAt,
      operation:
        row.operation == null
          ? null
          : {
              id: row.operation.id,
              title: row.operation.title,
              minorUnits: minorUnitsOf(row.operation.amount),
              operationDate: civilDateOf(row.operation.operationDate),
              categoryId: row.operation.categoryId,
            },
    };
  }
}
