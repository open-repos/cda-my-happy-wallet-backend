import { Prisma, PrismaClient, TypeOperationEnum } from "@prisma/client";
import {
  OneOffOperationRepository,
  OperationApplicationError,
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
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {}

  public async listByOwner(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OneOffOperation>> {
    const context = this.cursorContext(ownerId);
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
      afterDate === undefined ? undefined : new Date(`${afterDate}T00:00:00.000Z`);
    if (date !== undefined && Number.isNaN(date.getTime())) {
      throw invalidPagination();
    }
    const where: Prisma.OneOffOperationRecordWhereInput =
      date === undefined || afterId === undefined
        ? { userId: ownerId }
        : {
            userId: ownerId,
            OR: [
              { operationDate: { lt: date } },
              { operationDate: date, id: { lt: afterId } },
            ],
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

  public async create(operation: OneOffOperation): Promise<OneOffOperation> {
    const row = await this.prisma.oneOffOperationRecord.create({
      data: this.toPersistence(operation),
      include: { category: { select: { id: true, userId: true } } },
    });
    return this.toDomain(row);
  }

  public async update(
    operation: OneOffOperation
  ): Promise<OneOffOperation | null> {
    if (operation.id == null) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }

    const result = await this.prisma.oneOffOperationRecord.updateMany({
      where: { id: operation.id, userId: operation.ownerId },
      data: this.toPersistence(operation),
    });
    return result.count === 0
      ? null
      : this.findById(operation.id, operation.ownerId);
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const result = await this.prisma.oneOffOperationRecord.deleteMany({
      where: { id, userId: ownerId },
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

  private cursorContext(ownerId: number): CursorContext {
    return {
      resource: "one-off-operations",
      scope: `owner:${ownerId}`,
    };
  }
}
