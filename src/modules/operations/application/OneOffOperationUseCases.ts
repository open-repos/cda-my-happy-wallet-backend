import {
  CreateOneOffOperationProps,
  OneOffOperation,
} from "../domain";
import { OperationApplicationError } from "./OperationApplicationError";
import { OperationCategoryRepository } from "./OperationCategoryRepository.interface";
import { OneOffOperationRepository } from "./OneOffOperationRepository.interface";

export type SaveOneOffOperationInput = Readonly<
  Omit<CreateOneOffOperationProps, "id" | "ownerId" | "category"> & {
    categoryId: number;
  }
>;

export class OneOffOperationUseCases {
  public constructor(
    private readonly operations: OneOffOperationRepository,
    private readonly categories: OperationCategoryRepository
  ) {}

  public list(ownerId: number): Promise<readonly OneOffOperation[]> {
    return this.operations.listByOwner(ownerId);
  }

  public async get(ownerId: number, id: number): Promise<OneOffOperation> {
    const operation = await this.operations.findById(id, ownerId);
    if (operation == null) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }
    return operation;
  }

  public async create(
    ownerId: number,
    input: SaveOneOffOperationInput
  ): Promise<OneOffOperation> {
    return this.operations.create(await this.toDomain(ownerId, input));
  }

  public async update(
    ownerId: number,
    id: number,
    input: SaveOneOffOperationInput
  ): Promise<OneOffOperation> {
    const operation = await this.operations.update(
      await this.toDomain(ownerId, input, id)
    );
    if (operation == null) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }
    return operation;
  }

  public async delete(ownerId: number, id: number): Promise<void> {
    if (!(await this.operations.delete(id, ownerId))) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }
  }

  private async toDomain(
    ownerId: number,
    input: SaveOneOffOperationInput,
    id?: number
  ): Promise<OneOffOperation> {
    const category = await this.categories.findById(input.categoryId, ownerId);
    if (category == null) {
      throw new OperationApplicationError("CATEGORY_NOT_FOUND");
    }

    return OneOffOperation.create({
      id,
      ownerId,
      title: input.title,
      amount: input.amount,
      currency: input.currency,
      kind: input.kind,
      operationDate: input.operationDate,
      category: { id: category.id, ownerId: category.ownerId },
    });
  }
}
