/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
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
import { OneOffOperationController } from "../../../src/modules/operations/presentation";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { createOneOffOperationRouter } from "../../../src/routes/oneOffOperations";

const express = require("express") as typeof import("express");

class ApiCategoryRepository implements OperationCategoryRepository {
  public rows: OperationCategory[] = [];
  public isReferenced: (id: number, ownerId: number) => boolean = () => false;
  private nextId = 1;

  public async listByOwner(ownerId: number): Promise<OperationCategory[]> {
    return this.rows.filter((row) => row.ownerId === ownerId);
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OperationCategory | null> {
    return this.rows.find((row) => row.id === id && row.ownerId === ownerId) ?? null;
  }

  public async create(input: SaveOperationCategory): Promise<OperationCategory> {
    if (this.rows.some((row) => row.ownerId === input.ownerId && row.name === input.name)) {
      throw new OperationApplicationError("CATEGORY_NAME_CONFLICT");
    }
    const row = { ...input, id: this.nextId++ };
    this.rows = [...this.rows, row];
    return row;
  }

  public async update(
    id: number,
    input: SaveOperationCategory
  ): Promise<OperationCategory | null> {
    if ((await this.findById(id, input.ownerId)) == null) return null;
    const row = { ...input, id };
    this.rows = this.rows.map((item) =>
      item.id === id && item.ownerId === input.ownerId ? row : item
    );
    return row;
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    if (this.isReferenced(id, ownerId)) {
      throw new OperationApplicationError("CATEGORY_IN_USE");
    }
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) => row.id !== id || row.ownerId !== ownerId
    );
    return before !== this.rows.length;
  }
}

class ApiOperationRepository implements OneOffOperationRepository {
  public rows: OneOffOperation[] = [];
  private nextId = 1;

  public async listByOwner(ownerId: number): Promise<OneOffOperation[]> {
    return this.rows.filter((row) => row.ownerId === ownerId);
  }

  public async findById(
    id: number,
    ownerId: number
  ): Promise<OneOffOperation | null> {
    return this.rows.find((row) => row.id === id && row.ownerId === ownerId) ?? null;
  }

  public async create(operation: OneOffOperation): Promise<OneOffOperation> {
    const row = this.copy(operation, this.nextId++);
    this.rows = [...this.rows, row];
    return row;
  }

  public async update(
    operation: OneOffOperation
  ): Promise<OneOffOperation | null> {
    if (operation.id == null || (await this.findById(operation.id, operation.ownerId)) == null) {
      return null;
    }
    this.rows = this.rows.map((row) =>
      row.id === operation.id && row.ownerId === operation.ownerId
        ? operation
        : row
    );
    return operation;
  }

  public async delete(id: number, ownerId: number): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter(
      (row) => row.id !== id || row.ownerId !== ownerId
    );
    return before !== this.rows.length;
  }

  public referencesCategory(id: number, ownerId: number): boolean {
    return this.rows.some(
      (row) => row.categoryId === id && row.ownerId === ownerId
    );
  }

  private copy(operation: OneOffOperation, id: number): OneOffOperation {
    return OneOffOperation.create({
      id,
      ownerId: operation.ownerId,
      title: operation.title,
      amount: (operation.money.minorUnits / 100).toFixed(2),
      currency: operation.money.currency,
      kind: operation.kind,
      operationDate: operation.operationDate,
      category: { id: operation.categoryId, ownerId: operation.ownerId },
    });
  }
}

const authenticate = (req: Request, _: Response, next: NextFunction) => {
  if (req.headers.authorization === "Bearer owner") {
    req.user = { id: 7 };
    return next();
  }
  if (req.headers.authorization === "Bearer other") {
    req.user = { id: 8 };
    return next();
  }
  return next(new ErrorException(ErrorCode.Unauthorized));
};

async function run() {
  const categoryRepository = new ApiCategoryRepository();
  const operationRepository = new ApiOperationRepository();
  categoryRepository.isReferenced = (id, ownerId) =>
    operationRepository.referencesCategory(id, ownerId);
  const controller = new OneOffOperationController(
    new OneOffOperationUseCases(operationRepository, categoryRepository),
    new OperationCategoryUseCases(categoryRepository)
  );
  const app = express();
  app.use(express.json());
  app.use(createOneOffOperationRouter(controller, authenticate));
  app.use(errorHandler);

  const unauthenticated = await supertest(app).get("/operations");
  assert.strictEqual(unauthenticated.status, 401);

  const unknownField = await supertest(app)
    .post("/operation-categories")
    .set("Authorization", "Bearer owner")
    .send({ name: "Courses", ownerId: 999 });
  assert.strictEqual(unknownField.status, 422);
  assert.strictEqual(unknownField.body.error.type, "ValidationFailed");

  const categoryResponse = await supertest(app)
    .post("/operation-categories")
    .set("Authorization", "Bearer owner")
    .send({ name: "Courses", color: "#ea7c69" });
  assert.strictEqual(categoryResponse.status, 201);
  assert.deepStrictEqual(categoryResponse.body.data, {
    id: 1,
    name: "Courses",
    color: "#EA7C69",
  });
  assert.strictEqual(categoryResponse.body.data.ownerId, undefined);

  const duplicate = await supertest(app)
    .post("/operation-categories")
    .set("Authorization", "Bearer owner")
    .send({ name: "Courses" });
  assert.strictEqual(duplicate.status, 409);
  assert.strictEqual(duplicate.body.error.details.code, "CATEGORY_NAME_CONFLICT");

  const invalidCalendarDate = await supertest(app)
    .post("/operations")
    .set("Authorization", "Bearer owner")
    .send({
      title: "Date impossible",
      amount: "10.00",
      currency: "EUR",
      kind: "DEPENSE",
      operationDate: "2026-02-31",
      categoryId: 1,
    });
  assert.strictEqual(invalidCalendarDate.status, 422);
  assert.strictEqual(
    invalidCalendarDate.body.error.details.code,
    "INVALID_OPERATION_DATE"
  );

  const excessivePrecision = await supertest(app)
    .post("/operations")
    .set("Authorization", "Bearer owner")
    .send({
      title: "Montant arrondi interdit",
      amount: 10.999,
      currency: "EUR",
      kind: "DEPENSE",
      operationDate: "2026-08-10",
      categoryId: 1,
    });
  assert.strictEqual(excessivePrecision.status, 422);

  const created = await supertest(app)
    .post("/operations")
    .set("Authorization", "Bearer owner")
    .send({
      title: "Marché",
      amount: "12.30",
      currency: "eur",
      kind: "DEPENSE",
      operationDate: "2026-08-10",
      categoryId: 1,
    });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.headers.location, "/operations/1");
  assert.deepStrictEqual(created.body.data, {
    id: 1,
    title: "Marché",
    amount: "12.30",
    currency: "EUR",
    type: "DEPENSE",
    operationDate: "2026-08-10",
    categoryId: 1,
  });
  assert.strictEqual(created.body.data.ownerId, undefined);

  const hiddenFromOtherOwner = await supertest(app)
    .get("/operations/1")
    .set("Authorization", "Bearer other");
  assert.strictEqual(hiddenFromOtherOwner.status, 404);

  const categoryInUse = await supertest(app)
    .delete("/operation-categories/1")
    .set("Authorization", "Bearer owner");
  assert.strictEqual(categoryInUse.status, 409);
  assert.strictEqual(categoryInUse.body.error.details.code, "CATEGORY_IN_USE");

  const invalidId = await supertest(app)
    .get("/operations/not-a-number")
    .set("Authorization", "Bearer owner");
  assert.strictEqual(invalidId.status, 400);

  assert.strictEqual(
    (
      await supertest(app)
        .delete("/operations/1")
        .set("Authorization", "Bearer owner")
    ).status,
    204
  );
  assert.strictEqual(
    (
      await supertest(app)
        .delete("/operation-categories/1")
        .set("Authorization", "Bearer owner")
    ).status,
    204
  );
}

run()
  .then(() => console.log("One-off operation API tests passed"))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
