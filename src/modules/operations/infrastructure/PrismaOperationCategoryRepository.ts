import { Prisma, PrismaClient } from "@prisma/client";
import {
  OperationApplicationError,
  OperationCategory,
  OperationCategoryRepository,
  SaveOperationCategory,
} from "../application";

export class PrismaOperationCategoryRepository
  implements OperationCategoryRepository
{
  public constructor(private readonly prisma: PrismaClient) {}

  public async listByOwner(ownerId: number): Promise<OperationCategory[]> {
    const rows = await this.prisma.operationCategory.findMany({
      where: { userId: ownerId },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    return rows.map(this.toCategory);
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OperationCategory | null> {
    const row = await this.prisma.operationCategory.findFirst({
      where: { id, userId: ownerId },
    });
    return row == null ? null : this.toCategory(row);
  }

  public async create(
    category: SaveOperationCategory
  ): Promise<OperationCategory> {
    try {
      return this.toCategory(
        await this.prisma.operationCategory.create({
          data: {
            userId: category.ownerId,
            name: category.name,
            color: category.color,
          },
        })
      );
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  public async update(
    id: number,
    category: SaveOperationCategory
  ): Promise<OperationCategory | null> {
    try {
      const result = await this.prisma.operationCategory.updateMany({
        where: { id, userId: category.ownerId },
        data: { name: category.name, color: category.color },
      });
      return result.count === 0 ? null : this.findById(id, category.ownerId);
    } catch (error) {
      this.rethrowConflict(error);
    }
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    try {
      const result = await this.prisma.operationCategory.deleteMany({
        where: { id, userId: ownerId },
      });
      return result.count === 1;
    } catch (error) {
      if (this.hasPrismaCode(error, "P2003")) {
        throw new OperationApplicationError("CATEGORY_IN_USE");
      }
      throw error;
    }
  }

  private readonly toCategory = (row: {
    id: number;
    userId: number;
    name: string;
    color: string | null;
  }): OperationCategory => ({
    id: row.id,
    ownerId: row.userId,
    name: row.name,
    color: row.color,
  });

  private rethrowConflict(error: unknown): never {
    if (this.hasPrismaCode(error, "P2002")) {
      throw new OperationApplicationError("CATEGORY_NAME_CONFLICT");
    }
    throw error;
  }

  private hasPrismaCode(error: unknown, code: string): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === code
    );
  }
}
