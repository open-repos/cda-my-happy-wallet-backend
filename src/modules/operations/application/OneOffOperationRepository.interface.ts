import { OneOffOperation } from "../domain";
import { CursorPage, PaginationRequest } from "../../pagination";

export interface OneOffOperationRepository {
  listByOwner(
    ownerId: number,
    pagination: PaginationRequest
  ): Promise<CursorPage<OneOffOperation>>;
  findById(id: number, ownerId: number): Promise<OneOffOperation | null>;
  create(operation: OneOffOperation): Promise<OneOffOperation>;
  update(operation: OneOffOperation): Promise<OneOffOperation | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
