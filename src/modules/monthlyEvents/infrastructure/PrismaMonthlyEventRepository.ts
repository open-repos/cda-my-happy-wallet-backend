import {
  MonthlyEventKind,
  MonthlyEventRecurrence,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  createCursorPage,
  CursorContext,
  CursorPage,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";
import { MonthlyEventRepository } from "../application";
import { MonthlyEvent, MonthlyEventOccurrence } from "../domain";
import { matchesOccurrenceSql, occurrenceDatesSql } from "./eventOccurrenceSql";

type EventRow = Readonly<{
  id: number;
  title: string;
  amount: { toFixed(fractionDigits: number): string };
  currency: string;
  kind: MonthlyEventKind;
  startDate: Date;
  recurrence: MonthlyEventRecurrence;
  endDate: Date | null;
  userId: number;
}>;

type OccurrenceRow = EventRow & Readonly<{ occurrenceDate: Date }>;

export class PrismaMonthlyEventRepository implements MonthlyEventRepository {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {}

  public async listByOwner(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEvent>> {
    const context = this.context(ownerId, "monthly-events");
    const position = this.dateIdPosition(page, context);
    const afterDate = position?.[0] as string | undefined;
    const afterId = position?.[1] as number | undefined;
    const date = afterDate === undefined ? undefined : this.toDate(afterDate);
    const where: Prisma.EvenementMensuelWhereInput =
      date === undefined || afterId === undefined
        ? { userId: ownerId }
        : {
            userId: ownerId,
            OR: [
              { startDate: { gt: date } },
              { startDate: date, id: { gt: afterId } },
            ],
          };
    const rows = await this.prisma.evenementMensuel.findMany({
      where,
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      take: page.limit + 1,
    });
    return createCursorPage(
      rows.map((row) => this.toDomain(row)),
      page,
      context,
      (event) => {
        if (event.id == null) throw invalidPagination();
        return [event.startDate, event.id];
      },
      this.cursors
    );
  }

  public async listOccurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEventOccurrence>> {
    const context = this.context(ownerId, `monthly-event-occurrences:${month}`);
    const position = this.dateIdPosition(page, context);
    const afterDate = position?.[0] as string | undefined;
    const afterId = position?.[1] as number | undefined;
    const monthStart = `${month}-01`;
    const cursor =
      afterDate === undefined || afterId === undefined
        ? Prisma.empty
        : Prisma.sql`AND (d.occurrenceDate > STR_TO_DATE(${afterDate}, '%Y-%m-%d') OR (d.occurrenceDate = STR_TO_DATE(${afterDate}, '%Y-%m-%d') AND e.id > ${afterId}))`;
    const rows = await this.prisma.$queryRaw<OccurrenceRow[]>(Prisma.sql`
      ${occurrenceDatesSql(
        monthStart,
        Prisma.sql`LAST_DAY(STR_TO_DATE(${monthStart}, '%Y-%m-%d'))`
      )}
      SELECT e.id, e.titre AS title, e.montant AS amount, e.devise AS currency, e.kind,
             e.startDate, e.recurrence, e.endDate, e.userId, d.occurrenceDate
      FROM EvenementMensuel e JOIN occurrence_dates d ON ${matchesOccurrenceSql}
      WHERE e.userId = ${ownerId}
        ${cursor}
      ORDER BY d.occurrenceDate ASC, e.id ASC
      LIMIT ${page.limit + 1}
    `);
    return createCursorPage(
      rows.map((row) => ({
        event: this.toDomain(row),
        occurrenceDate: row.occurrenceDate.toISOString().slice(0, 10),
      })),
      page,
      context,
      (item) => {
        if (item.event.id == null) throw invalidPagination();
        return [item.occurrenceDate, item.event.id];
      },
      this.cursors
    );
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<MonthlyEvent | null> {
    const row = await this.prisma.evenementMensuel.findFirst({
      where: { id, userId: ownerId },
    });
    return row == null ? null : this.toDomain(row);
  }

  public async create(event: MonthlyEvent): Promise<MonthlyEvent> {
    return this.toDomain(
      await this.prisma.evenementMensuel.create({
        data: this.toPersistence(event),
      })
    );
  }

  public async update(event: MonthlyEvent): Promise<MonthlyEvent | null> {
    if (event.id == null) return null;
    const result = await this.prisma.evenementMensuel.updateMany({
      where: { id: event.id, userId: event.ownerId },
      data: this.toPersistence(event),
    });
    return result.count === 0 ? null : this.findById(event.id, event.ownerId);
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    return (
      (
        await this.prisma.evenementMensuel.deleteMany({
          where: { id, userId: ownerId },
        })
      ).count === 1
    );
  }

  private toPersistence(event: MonthlyEvent) {
    return {
      title: event.title,
      amount: (event.minorUnits / 100).toFixed(2),
      currency: event.currency,
      kind: event.kind,
      startDate: this.toDate(event.startDate),
      recurrence: event.recurrence,
      endDate: event.endDate == null ? null : this.toDate(event.endDate),
      userId: event.ownerId,
    };
  }

  private toDomain(row: EventRow): MonthlyEvent {
    return MonthlyEvent.create({
      id: row.id,
      ownerId: row.userId,
      title: row.title,
      amount: row.amount.toFixed(2),
      currency: row.currency,
      kind: row.kind,
      startDate: row.startDate.toISOString().slice(0, 10),
      recurrence: row.recurrence,
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
    });
  }

  private dateIdPosition(
    page: PaginationRequest,
    context: CursorContext
  ): readonly [string, number] | null {
    if (page.cursor == null) return null;
    const position = this.cursors.decode(context, page.cursor);
    if (
      position.length !== 2 ||
      typeof position[0] !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(position[0]) ||
      typeof position[1] !== "number" ||
      !Number.isSafeInteger(position[1]) ||
      position[1] <= 0
    ) {
      throw invalidPagination();
    }
    return [position[0], position[1]];
  }

  private toDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) throw invalidPagination();
    return date;
  }

  private context(ownerId: number, resource: string): CursorContext {
    return { resource, scope: `owner:${ownerId}` };
  }
}
