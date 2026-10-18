import { CursorPage, PaginationRequest } from "../../pagination";
import {
  MonthlyEvent,
  MonthlyEventOccurrence,
  MonthlyEventProps,
} from "../domain/MonthlyEvent";
import { MonthlyEventRepository } from "./MonthlyEventRepository";

export class MonthlyEventApplicationError extends Error {
  public constructor(
    public readonly code: "EVENT_NOT_FOUND" | "INVALID_MONTH"
  ) {
    super(code);
    this.name = "MonthlyEventApplicationError";
  }
}

export type SaveMonthlyEventInput = Omit<MonthlyEventProps, "id" | "ownerId">;

export class MonthlyEventUseCases {
  public constructor(private readonly repository: MonthlyEventRepository) {}

  public list(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEvent>> {
    return this.repository.listByOwner(ownerId, page);
  }

  public occurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest
  ): Promise<CursorPage<MonthlyEventOccurrence>> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new MonthlyEventApplicationError("INVALID_MONTH");
    }
    return this.repository.listOccurrences(ownerId, month, page);
  }

  public async get(ownerId: number, id: number): Promise<MonthlyEvent> {
    const event = await this.repository.findById(id, ownerId);
    if (event == null)
      throw new MonthlyEventApplicationError("EVENT_NOT_FOUND");
    return event;
  }

  public create(
    ownerId: number,
    input: SaveMonthlyEventInput
  ): Promise<MonthlyEvent> {
    return this.repository.create(MonthlyEvent.create({ ...input, ownerId }));
  }

  public async update(
    ownerId: number,
    id: number,
    input: SaveMonthlyEventInput
  ): Promise<MonthlyEvent> {
    const event = await this.repository.update(
      MonthlyEvent.create({ ...input, id, ownerId })
    );
    if (event == null)
      throw new MonthlyEventApplicationError("EVENT_NOT_FOUND");
    return event;
  }

  public async delete(ownerId: number, id: number): Promise<void> {
    if (!(await this.repository.delete(id, ownerId))) {
      throw new MonthlyEventApplicationError("EVENT_NOT_FOUND");
    }
  }
}
