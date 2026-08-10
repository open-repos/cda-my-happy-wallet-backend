import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import {
  OneOffOperationUseCases,
  OperationCategory,
  OperationCategoryUseCases,
} from "../application";
import { OneOffOperation } from "../domain";
import { parseResourceId } from "./operationValidators";

export class OneOffOperationController {
  public constructor(
    private readonly operations: OneOffOperationUseCases,
    private readonly categories: OperationCategoryUseCases
  ) {}

  public async listCategories(req: Request, res: Response): Promise<Response> {
    const rows = await this.categories.list(this.ownerId(req));
    return res.status(200).json({ data: rows.map(this.categoryDto) });
  }

  public async createCategory(req: Request, res: Response): Promise<Response> {
    const row = await this.categories.create(this.ownerId(req), req.body);
    return res.status(201).json({ data: this.categoryDto(row) });
  }

  public async updateCategory(req: Request, res: Response): Promise<Response> {
    const row = await this.categories.update(
      this.ownerId(req),
      parseResourceId(req.params.id),
      req.body
    );
    return res.status(200).json({ data: this.categoryDto(row) });
  }

  public async deleteCategory(req: Request, res: Response): Promise<Response> {
    await this.categories.delete(
      this.ownerId(req),
      parseResourceId(req.params.id)
    );
    return res.status(204).send();
  }

  public async listOperations(req: Request, res: Response): Promise<Response> {
    const rows = await this.operations.list(this.ownerId(req));
    return res.status(200).json({ data: rows.map(this.operationDto) });
  }

  public async getOperation(req: Request, res: Response): Promise<Response> {
    const row = await this.operations.get(
      this.ownerId(req),
      parseResourceId(req.params.id)
    );
    return res.status(200).json({ data: this.operationDto(row) });
  }

  public async createOperation(req: Request, res: Response): Promise<Response> {
    const row = await this.operations.create(this.ownerId(req), req.body);
    res.location(`${req.originalUrl}/${row.id}`);
    return res.status(201).json({ data: this.operationDto(row) });
  }

  public async updateOperation(req: Request, res: Response): Promise<Response> {
    const row = await this.operations.update(
      this.ownerId(req),
      parseResourceId(req.params.id),
      req.body
    );
    return res.status(200).json({ data: this.operationDto(row) });
  }

  public async deleteOperation(req: Request, res: Response): Promise<Response> {
    await this.operations.delete(
      this.ownerId(req),
      parseResourceId(req.params.id)
    );
    return res.status(204).send();
  }

  private ownerId(req: Request): number {
    return Number(getAuthenticatedUserId(req));
  }

  private readonly categoryDto = (category: OperationCategory) => ({
    id: category.id,
    name: category.name,
    color: category.color,
  });

  private readonly operationDto = (operation: OneOffOperation) => ({
    id: operation.id,
    title: operation.title,
    amount: (operation.money.minorUnits / 100).toFixed(2),
    currency: operation.money.currency,
    type: operation.kind,
    operationDate: operation.operationDate,
    categoryId: operation.categoryId,
  });
}
