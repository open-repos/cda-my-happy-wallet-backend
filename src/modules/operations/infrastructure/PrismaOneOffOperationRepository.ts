import { PrismaClient, TypeOperationEnum } from "@prisma/client";
import {
  OneOffOperationRepository,
  OperationApplicationError,
} from "../application";
import { OneOffOperation } from "../domain";

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
  public constructor(private readonly prisma: PrismaClient) {}

  public async listByOwner(ownerId: number): Promise<OneOffOperation[]> {
    const rows = await this.prisma.oneOffOperationRecord.findMany({
      where: { userId: ownerId },
      include: { category: { select: { id: true, userId: true } } },
      orderBy: [{ operationDate: "desc" }, { id: "desc" }],
    });
    return rows.map((row) => this.toDomain(row));
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
}
