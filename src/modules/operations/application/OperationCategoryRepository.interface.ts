export type OperationCategory = Readonly<{
  id: number;
  ownerId: number;
  name: string;
  color: string | null;
}>;

export type SaveOperationCategory = Readonly<{
  ownerId: number;
  name: string;
  color: string | null;
}>;

export interface OperationCategoryRepository {
  listByOwner(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationCategory>>;
  findById(id: number, ownerId: number): Promise<OperationCategory | null>;
  create(category: SaveOperationCategory): Promise<OperationCategory>;
  update(
    id: number,
    category: SaveOperationCategory
  ): Promise<OperationCategory | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
import { CursorPage, PaginationRequest } from "../../pagination";
