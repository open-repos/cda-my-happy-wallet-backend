import { OneOffOperation } from "../domain";

export interface OneOffOperationRepository {
  listByOwner(ownerId: number): Promise<readonly OneOffOperation[]>;
  findById(id: number, ownerId: number): Promise<OneOffOperation | null>;
  create(operation: OneOffOperation): Promise<OneOffOperation>;
  update(operation: OneOffOperation): Promise<OneOffOperation | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
