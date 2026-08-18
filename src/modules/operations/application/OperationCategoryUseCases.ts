import {
  OperationCategory,
  OperationCategoryRepository,
  SaveOperationCategory,
} from "./OperationCategoryRepository.interface";
import { OperationApplicationError } from "./OperationApplicationError";
import { CursorPage, PaginationRequest } from "../../pagination";

export type SaveOperationCategoryInput = Readonly<{
  name: string;
  color?: string | null;
}>;

export class OperationCategoryUseCases {
  public constructor(
    private readonly categories: OperationCategoryRepository
  ) {}

  public list(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationCategory>> {
    return this.categories.listByOwner(ownerId, pagination);
  }

  public async create(
    ownerId: number,
    input: SaveOperationCategoryInput
  ): Promise<OperationCategory> {
    return this.categories.create(this.normalize(ownerId, input));
  }

  public async update(
    ownerId: number,
    id: number,
    input: SaveOperationCategoryInput
  ): Promise<OperationCategory> {
    const category = await this.categories.update(
      id,
      this.normalize(ownerId, input)
    );

    if (category == null) {
      throw new OperationApplicationError("CATEGORY_NOT_FOUND");
    }

    return category;
  }

  public async delete(ownerId: number, id: number): Promise<void> {
    if (!(await this.categories.delete(id, ownerId))) {
      throw new OperationApplicationError("CATEGORY_NOT_FOUND");
    }
  }

  private normalize(
    ownerId: number,
    input: SaveOperationCategoryInput
  ): SaveOperationCategory {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < 2 || name.length > 50) {
      throw new OperationApplicationError("INVALID_CATEGORY_NAME");
    }

    const color = input.color ?? null;
    if (color !== null && !/^#[0-9A-F]{6}$/i.test(color)) {
      throw new OperationApplicationError("INVALID_CATEGORY_COLOR");
    }

    return { ownerId, name, color: color?.toUpperCase() ?? null };
  }
}
