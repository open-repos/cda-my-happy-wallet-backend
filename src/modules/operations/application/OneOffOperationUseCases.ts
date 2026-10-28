import { CreateOneOffOperationProps, OneOffOperation } from "../domain";
import { OperationApplicationError } from "./OperationApplicationError";
import { OperationCategoryRepository } from "./OperationCategoryRepository.interface";
import {
  OneOffOperationRepository,
  OperationListFilter,
  OperationReconciliationInput,
} from "./OneOffOperationRepository.interface";
import { CursorPage, PaginationRequest } from "../../pagination";

export type SaveOneOffOperationInput = Readonly<
  Omit<CreateOneOffOperationProps, "id" | "ownerId" | "category"> & {
    categoryId: number;
    reconciliation?: OperationReconciliationInput;
  }
>;

/** Notifie le budget qu'une écriture a touché ces dates et devises. */
export type OperationCorrectionListener = Readonly<{
  afterOperationChange(
    ownerId: number,
    changes: readonly Readonly<{ operationDate: string; currency: string }>[]
  ): Promise<void>;
}>;

const ignoreCorrections: OperationCorrectionListener = {
  afterOperationChange: async () => undefined,
};

const changeOf = (operation: OneOffOperation) => ({
  operationDate: operation.operationDate,
  currency: operation.money.currency,
});

export class OneOffOperationUseCases {
  public constructor(
    private readonly operations: OneOffOperationRepository,
    private readonly categories: OperationCategoryRepository,
    private readonly corrections: OperationCorrectionListener = ignoreCorrections
  ) {}

  public list(
    ownerId: number,
    pagination: PaginationRequest,
    filter: OperationListFilter = {}
  ): Promise<CursorPage<OneOffOperation>> {
    return this.operations.listByOwner(ownerId, pagination, filter);
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
    const operation = await this.operations.create(
      await this.toDomain(ownerId, input),
      input.reconciliation
    );
    await this.corrections.afterOperationChange(ownerId, [changeOf(operation)]);
    return operation;
  }

  public async update(
    ownerId: number,
    id: number,
    input: SaveOneOffOperationInput
  ): Promise<OneOffOperation> {
    const before = await this.operations.findById(id, ownerId);
    const operation =
      before == null
        ? null
        : await this.operations.update(
            await this.toDomain(ownerId, input, id),
            input.reconciliation
          );
    if (before == null || operation == null) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }
    // L'ancienne et la nouvelle date ou devise peuvent toucher deux chaînes.
    await this.corrections.afterOperationChange(ownerId, [
      changeOf(before),
      changeOf(operation),
    ]);
    return operation;
  }

  public async delete(ownerId: number, id: number): Promise<void> {
    const before = await this.operations.findById(id, ownerId);
    if (before == null || !(await this.operations.delete(id, ownerId))) {
      throw new OperationApplicationError("OPERATION_NOT_FOUND");
    }
    await this.corrections.afterOperationChange(ownerId, [changeOf(before)]);
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
