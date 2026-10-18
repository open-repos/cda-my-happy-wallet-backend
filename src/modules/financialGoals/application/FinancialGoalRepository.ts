import { CursorPage, PaginationRequest } from "../../pagination";
import { FinancialGoal } from "../domain/FinancialGoal";

export interface FinancialGoalRepository {
  listByOwner(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<FinancialGoal>>;
  findById(id: number, ownerId: number): Promise<FinancialGoal | null>;
  create(goal: FinancialGoal): Promise<FinancialGoal>;
  update(goal: FinancialGoal): Promise<FinancialGoal | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
