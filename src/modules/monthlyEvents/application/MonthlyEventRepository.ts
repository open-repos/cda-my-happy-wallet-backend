import { CursorPage, PaginationRequest } from "../../pagination";
import {
  BudgetScenario,
  MonthlyEvent,
  MonthlyEventOccurrence,
  MonthlyEventStatus,
} from "../domain/MonthlyEvent";

export interface MonthlyEventRepository {
  listByOwner(
    ownerId: number,
    page: PaginationRequest,
    status?: MonthlyEventStatus
  ): Promise<CursorPage<MonthlyEvent>>;
  listOccurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest,
    scenario?: BudgetScenario
  ): Promise<CursorPage<MonthlyEventOccurrence>>;
  findById(id: number, ownerId: number): Promise<MonthlyEvent | null>;
  create(event: MonthlyEvent): Promise<MonthlyEvent>;
  update(event: MonthlyEvent): Promise<MonthlyEvent | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
  confirm(id: number, ownerId: number): Promise<MonthlyEvent | null>;
  clearPotential(ownerId: number): Promise<void>;
}
