import { CursorPage, PaginationRequest } from "../../pagination";
import { MonthlyEvent, MonthlyEventOccurrence } from "../domain/MonthlyEvent";

export interface MonthlyEventRepository {
  listByOwner(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEvent>>;
  listOccurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEventOccurrence>>;
  findById(id: number, ownerId: number): Promise<MonthlyEvent | null>;
  create(event: MonthlyEvent): Promise<MonthlyEvent>;
  update(event: MonthlyEvent): Promise<MonthlyEvent | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
