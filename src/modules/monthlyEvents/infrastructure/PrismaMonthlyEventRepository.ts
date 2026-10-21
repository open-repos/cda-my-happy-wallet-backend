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
import {
  BudgetScenario,
  MonthlyEvent,
  MonthlyEventOccurrence,
  MonthlyEventStatus,
} from "../domain";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import {
  deletePotentialEvents,
  expirePotentialEvents,
  potentialCutoff,
} from "./potentialEventMaintenance";
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
  status: MonthlyEventStatus;
}>;

type OccurrenceRow = EventRow & Readonly<{ occurrenceDate: Date }>;

export class PrismaMonthlyEventRepository implements MonthlyEventRepository {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async listByOwner(
    ownerId: number,
    page: PaginationRequest,
    status: MonthlyEventStatus = "CONFIRME"
  ): Promise<CursorPage<MonthlyEvent>> {
    await expirePotentialEvents(this.prisma, ownerId, this.today());
    const context = this.context(
      ownerId,
      status === "CONFIRME" ? "monthly-events" : `monthly-events:${status}`
    );
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
      where: { ...where, status },
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
    page: PaginationRequest,
    scenario: BudgetScenario = "standard"
  ): Promise<CursorPage<MonthlyEventOccurrence>> {
    await expirePotentialEvents(this.prisma, ownerId, this.today());
    const context = this.context(
      ownerId,
      `monthly-event-occurrences:${month}${
        scenario === "simulation" ? ":simulation" : ""
      }`
    );
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
             e.startDate, e.recurrence, e.endDate, e.status, e.userId, d.occurrenceDate
      FROM EvenementMensuel e JOIN occurrence_dates d ON ${matchesOccurrenceSql}
      WHERE e.userId = ${ownerId}
        ${
          scenario === "simulation"
            ? Prisma.empty
            : Prisma.sql`AND e.status = 'CONFIRME'`
        }
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
    await expirePotentialEvents(this.prisma, ownerId, this.today());
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
      where: { id: event.id, userId: event.ownerId, status: event.status },
      data: this.toPersistence(event),
    });
    return result.count === 0 ? null : this.findById(event.id, event.ownerId);
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    await expirePotentialEvents(this.prisma, ownerId, this.today());
    if ((await deletePotentialEvents(this.prisma, ownerId, { id })) === 1)
      return true;
    return (
      (
        await this.prisma.evenementMensuel.deleteMany({
          where: { id, userId: ownerId, status: "CONFIRME" },
        })
      ).count === 1
    );
  }

  public async confirm(
    id: number,
    ownerId: number
  ): Promise<MonthlyEvent | null> {
    const today = this.today();
    await expirePotentialEvents(this.prisma, ownerId, today);
    await this.prisma.evenementMensuel.updateMany({
      where: {
        id,
        userId: ownerId,
        status: "POTENTIEL",
        startDate: { gte: potentialCutoff(today) },
      },
      data: { status: "CONFIRME" },
    });
    return this.findById(id, ownerId);
  }

  public async clearPotential(ownerId: number): Promise<void> {
    await deletePotentialEvents(this.prisma, ownerId);
  }

  private toPersistence(event: MonthlyEvent) {
    return {
      title: event.title,
      amount: (event.minorUnits / 100).toFixed(2),
      currency: event.currency,
      kind: event.kind,
      status: event.status,
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
      status: row.status,
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
