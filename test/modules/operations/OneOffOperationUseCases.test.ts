import assert from "assert";
import {
  OneOffOperationRepository,
  OneOffOperationUseCases,
  OperationApplicationError,
  OperationCategory,
  OperationCategoryRepository,
  OperationCategoryUseCases,
  SaveOperationCategory,
} from "../../../src/modules/operations/application";
import { OneOffOperation } from "../../../src/modules/operations/domain";
import {
  CursorPage,
  PaginationRequest,
} from "../../../src/modules/pagination";

const firstPage: PaginationRequest = { limit: 50, cursor: null };

class FakeCategoryRepository implements OperationCategoryRepository {
  public categories: OperationCategory[] = [];
  private nextId = 1;

  public async listByOwner(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationCategory>> {
    return {
      data: this.categories
        .filter((category) => category.ownerId === ownerId)
        .slice(0, pagination.limit),
      meta: { limit: pagination.limit, hasNext: false, nextCursor: null },
    };
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OperationCategory | null> {
    return (
      this.categories.find(
        (category) => category.id === id && category.ownerId === ownerId
      ) ?? null
    );
  }

  public async create(
    category: SaveOperationCategory
  ): Promise<OperationCategory> {
    const saved = { ...category, id: this.nextId++ };
    this.categories = [...this.categories, saved];
    return saved;
  }

  public async update(
    id: number,
    category: SaveOperationCategory
  ): Promise<OperationCategory | null> {
    const existing = await this.findById(id, category.ownerId);
    if (existing == null) return null;
    const saved = { ...category, id };
    this.categories = this.categories.map((item) =>
      item.id === id && item.ownerId === category.ownerId ? saved : item
    );
    return saved;
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const before = this.categories.length;
    this.categories = this.categories.filter(
      (category) => category.id !== id || category.ownerId !== ownerId
    );
    return this.categories.length !== before;
  }
}

class FakeOperationRepository implements OneOffOperationRepository {
  public operations: OneOffOperation[] = [];
  private nextId = 1;

  public async listByOwner(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OneOffOperation>> {
    return {
      data: this.operations
        .filter((operation) => operation.ownerId === ownerId)
        .slice(0, pagination.limit),
      meta: { limit: pagination.limit, hasNext: false, nextCursor: null },
    };
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OneOffOperation | null> {
    return (
      this.operations.find(
        (operation) => operation.id === id && operation.ownerId === ownerId
      ) ?? null
    );
  }

  public async create(operation: OneOffOperation): Promise<OneOffOperation> {
    const saved = this.withId(operation, this.nextId++);
    this.operations = [...this.operations, saved];
    return saved;
  }

  public async update(
    operation: OneOffOperation
  ): Promise<OneOffOperation | null> {
    if (operation.id == null) return null;
    const existing = await this.findById(operation.id, operation.ownerId);
    if (existing == null) return null;
    this.operations = this.operations.map((item) =>
      item.id === operation.id && item.ownerId === operation.ownerId
        ? operation
        : item
    );
    return operation;
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const before = this.operations.length;
    this.operations = this.operations.filter(
      (operation) => operation.id !== id || operation.ownerId !== ownerId
    );
    return this.operations.length !== before;
  }

  private withId(operation: OneOffOperation, id: number): OneOffOperation {
    return OneOffOperation.create({
      id,
      ownerId: operation.ownerId,
      title: operation.title,
      amount: (operation.money.minorUnits / 100).toFixed(2),
      currency: operation.money.currency,
      kind: operation.kind,
      operationDate: operation.operationDate,
      category: {
        id: operation.categoryId,
        ownerId: operation.ownerId,
      },
    });
  }
}

const expectsApplicationError = (
  code: OperationApplicationError["code"]
) => (error: unknown): boolean =>
  error instanceof OperationApplicationError && error.code === code;

async function run() {
  const categoryRepository = new FakeCategoryRepository();
  const operationRepository = new FakeOperationRepository();
  const categories = new OperationCategoryUseCases(categoryRepository);
  const operations = new OneOffOperationUseCases(
    operationRepository,
    categoryRepository
  );

  const category = await categories.create(7, {
    name: "  Courses  ",
    color: "#ea7c69",
  });
  assert.deepStrictEqual(category, {
    id: 1,
    ownerId: 7,
    name: "Courses",
    color: "#EA7C69",
  });

  await assert.rejects(
    () => categories.create(7, { name: "x" }),
    expectsApplicationError("INVALID_CATEGORY_NAME")
  );
  await assert.rejects(
    () => categories.create(7, { name: "Valide", color: "rouge" }),
    expectsApplicationError("INVALID_CATEGORY_COLOR")
  );

  const operation = await operations.create(7, {
    title: "Courses semaine",
    amount: "42.50",
    currency: "eur",
    kind: "DEPENSE",
    operationDate: "2026-08-10",
    categoryId: category.id,
  });
  assert.strictEqual(operation.id, 1);
  assert.strictEqual(operation.money.minorUnits, 4250);
  assert.strictEqual((await operations.list(7, firstPage)).data.length, 1);
  assert.strictEqual((await operations.list(8, firstPage)).data.length, 0);

  await assert.rejects(
    () => operations.get(8, operation.id!),
    expectsApplicationError("OPERATION_NOT_FOUND")
  );
  await assert.rejects(
    () =>
      operations.create(8, {
        title: "Categorie étrangère",
        amount: "5.00",
        currency: "EUR",
        kind: "DEPENSE",
        operationDate: "2026-08-10",
        categoryId: category.id,
      }),
    expectsApplicationError("CATEGORY_NOT_FOUND")
  );

  const updated = await operations.update(7, operation.id!, {
    title: "Salaire exceptionnel",
    amount: "100.00",
    currency: "EUR",
    kind: "ENTREE",
    operationDate: "2026-08-11",
    categoryId: category.id,
  });
  assert.strictEqual(updated.kind, "ENTREE");
  assert.strictEqual(updated.money.minorUnits, 10000);

  await operations.delete(7, operation.id!);
  await assert.rejects(
    () => operations.get(7, operation.id!),
    expectsApplicationError("OPERATION_NOT_FOUND")
  );
  await assert.rejects(
    () => categories.delete(8, category.id),
    expectsApplicationError("CATEGORY_NOT_FOUND")
  );
}

run().catch((error) => {
  throw error;
});
