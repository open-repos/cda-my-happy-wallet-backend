import { ReconciliationError } from "../../reconciliation/domain/Reconciliation";
import {
  applyReconciliationLink,
  guardLinkedOperation,
  lockReconciliationOwner,
} from "../../reconciliation/infrastructure/reconciliationLocks";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { Prisma, PrismaClient, TypeOperationEnum } from "@prisma/client";
import {
  OneOffOperationRepository,
  OperationApplicationError,
  OperationListFilter,
  OperationReconciliationInput,
} from "../application";
import { OneOffOperation } from "../domain";
import {
  createCursorPage,
  CursorContext,
  CursorPage,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";

type OperationRow = Readonly<{
  id: number;
  title: string;
  amount: { toFixed(fractionDigits: number): string };
  currency: string;
  type: TypeOperationEnum;
  operationDate: Date;
  userId: number;
  category: { id: number; userId: number };
}>;

export class PrismaOneOffOperationRepository
  implements OneOffOperationRepository
{
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async listByOwner(
    ownerId: number,
    pagination: PaginationRequest,
    filter: OperationListFilter = {}
  ): Promise<CursorPage<OneOffOperation>> {
    const context = this.cursorContext(ownerId, filter);
    const position =
      pagination.cursor == null
        ? null
        : this.cursors.decode(context, pagination.cursor);
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

    const afterDate = position?.[0] as string | undefined;
    const afterId = position?.[1] as number | undefined;
    const date =
      afterDate === undefined
        ? undefined
        : new Date(`${afterDate}T00:00:00.000Z`);
    if (date !== undefined && Number.isNaN(date.getTime())) {
      throw invalidPagination();
    }
    const where: Prisma.OneOffOperationRecordWhereInput = {
      userId: ownerId,
      ...(filter.currency === undefined ? {} : { currency: filter.currency }),
      ...(filter.from === undefined && filter.to === undefined
        ? {}
        : {
            operationDate: {
              ...(filter.from === undefined
                ? {}
                : { gte: new Date(`${filter.from}T00:00:00.000Z`) }),
              ...(filter.to === undefined
                ? {}
                : { lte: new Date(`${filter.to}T00:00:00.000Z`) }),
            },
          }),
      ...(date === undefined || afterId === undefined
        ? {}
        : {
            AND: [
              {
                OR: [
                  { operationDate: { lt: date } },
                  { operationDate: date, id: { lt: afterId } },
                ],
              },
            ],
          }),
    };
    const rows = await this.prisma.oneOffOperationRecord.findMany({
      where,
      include: { category: { select: { id: true, userId: true } } },
      orderBy: [{ operationDate: "desc" }, { id: "desc" }],
      take: pagination.limit + 1,
    });
    return createCursorPage(
      rows.map((row) => this.toDomain(row)),
      pagination,
      context,
      (row) => {
        if (row.id == null) throw invalidPagination();
        return [row.operationDate, row.id];
      },
      this.cursors
    );
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OneOffOperation | null> {
    const row = await this.prisma.oneOffOperationRecord.findFirst({
      where: { id, userId: ownerId },
      include: { category: { select: { id: true, userId: true } } },
    });
    return row == null ? null : this.toDomain(row);
  }

  public async create(
    operation: OneOffOperation,
    reconciliation?: OperationReconciliationInput
  ): Promise<OneOffOperation> {
    const row = await this.prisma.$transaction(async (tx) => {
      await lockReconciliationOwner(tx, operation.ownerId);
      if (reconciliation && reconciliation.expectedOccurrenceId !== null) throw new ReconciliationError("ASSOCIATION_CONFLICT");
      const created = await tx.oneOffOperationRecord.create({
        data: this.toPersistence(operation),
        include: { category: { select: { id: true, userId: true } } },
      });
      if (reconciliation)
        await applyReconciliationLink(
          tx,
          operation.ownerId,
          created.id,
          reconciliation.occurrenceId,
          reconciliation.expectedOccurrenceId,
          this.today()
        );
      return created;
    });
    return this.toDomain(row);
  }

  public async update(
    operation: OneOffOperation,
    reconciliation?: OperationReconciliationInput
  ): Promise<OneOffOperation | null> {
    if (operation.id == null) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }

    return this.prisma.$transaction(async (tx) => {
      await lockReconciliationOwner(tx, operation.ownerId);
      const before = await tx.oneOffOperationRecord.findFirst({
        where: { id: operation.id, userId: operation.ownerId },
      });
      if (!before) return null;
      await guardLinkedOperation(
        tx,
        operation.ownerId,
        operation.id!,
        reconciliation === undefined
          ? {
              operationDate: operation.operationDate,
              currency: operation.money.currency,
              kind: operation.kind,
            }
          : undefined,
        this.today()
      );
      const updated = await tx.oneOffOperationRecord.update({
        where: { id: operation.id },
        data: this.toPersistence(operation),
        include: { category: { select: { id: true, userId: true } } },
      });
      if (reconciliation)
        await applyReconciliationLink(
          tx,
          operation.ownerId,
          operation.id!,
          reconciliation.occurrenceId,
          reconciliation.expectedOccurrenceId,
          this.today()
        );
      return this.toDomain(updated);
    });
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      await lockReconciliationOwner(tx, ownerId);
      await guardLinkedOperation(tx, ownerId, id, undefined, this.today());
      return tx.oneOffOperationRecord.deleteMany({
        where: { id, userId: ownerId },
      });
    });
    return result.count === 1;
  }

  private toPersistence(operation: OneOffOperation) {
    return {
      title: operation.title,
      amount: (operation.money.minorUnits / 100).toFixed(2),
      currency: operation.money.currency,
      type: operation.kind,
      operationDate: new Date(`${operation.operationDate}T00:00:00.000Z`),
      userId: operation.ownerId,
      categoryId: operation.categoryId,
    };
  }

  private toDomain(row: OperationRow): OneOffOperation {
    return OneOffOperation.create({
      id: row.id,
      ownerId: row.userId,
      title: row.title,
      amount: row.amount.toFixed(2),
      currency: row.currency,
      kind: row.type,
      operationDate: row.operationDate.toISOString().slice(0, 10),
      category: { id: row.category.id, ownerId: row.category.userId },
    });
  }

  /** Les filtres font partie du contexte : un curseur ne change pas de liste. */
  private cursorContext(
    ownerId: number,
    filter: OperationListFilter = {}
  ): CursorContext {
    const filters = [filter.from ?? "", filter.to ?? "", filter.currency ?? ""];
    return {
      resource: "one-off-operations",
      scope: filters.some((value) => value !== "")
        ? `owner:${ownerId}:${filters.join(":")}`
        : `owner:${ownerId}`,
    };
  }
}
