import { Prisma, PrismaClient } from "@prisma/client";
import {
  OperationApplicationError,
  OperationCategory,
  OperationCategoryRepository,
  SaveOperationCategory,
} from "../application";
import {
  createCursorPage,
  CursorContext,
  CursorPage,
  invalidPagination,
  paginationCursorCodec,
  PaginationCursorCodec,
  PaginationRequest,
} from "../../pagination";

export class PrismaOperationCategoryRepository
  implements OperationCategoryRepository
{
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly cursors: PaginationCursorCodec = paginationCursorCodec
  ) {}

  public async listByOwner(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationCategory>> {
    const context = this.cursorContext(ownerId);
    const position =
      pagination.cursor == null
        ? null
        : this.cursors.decode(context, pagination.cursor);
    if (
      position !== null &&
      (position.length !== 2 ||
        typeof position[0] !== "string" ||
        typeof position[1] !== "number" ||
        !Number.isSafeInteger(position[1]) ||
        position[1] <= 0)
    ) {
      throw invalidPagination();
    }

    const afterName = position?.[0] as string | undefined;
    const afterId = position?.[1] as number | undefined;
    const where: Prisma.OperationCategoryWhereInput =
      afterName === undefined || afterId === undefined
        ? { userId: ownerId }
        : {
            userId: ownerId,
            OR: [
              { name: { gt: afterName } },
              { name: afterName, id: { gt: afterId } },
            ],
          };
    const rows = await this.prisma.operationCategory.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: pagination.limit + 1,
    });
    return createCursorPage(
      rows.map(this.toCategory),
      pagination,
      context,
      (row) => [row.name, row.id],
      this.cursors
    );
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

  private cursorContext(ownerId: number): CursorContext {
    return {
      resource: "operation-categories",
      scope: `owner:${ownerId}`,
    };
  }

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
