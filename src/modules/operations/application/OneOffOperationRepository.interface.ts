import { OneOffOperation } from "../domain";
import { CursorPage, PaginationRequest } from "../../pagination";

/** Bornes civiles inclusives et devise facultatives d'une liste d'opérations. */
export type OperationListFilter = Readonly<{
  from?: string;
  to?: string;
  currency?: string;
}>;

export interface OneOffOperationRepository {
  listByOwner(
    ownerId: number,
    pagination: PaginationRequest,
    filter?: OperationListFilter
  ): Promise<CursorPage<OneOffOperation>>;
  findById(id: number, ownerId: number): Promise<OneOffOperation | null>;
  create(operation: OneOffOperation): Promise<OneOffOperation>;
  update(operation: OneOffOperation): Promise<OneOffOperation | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
