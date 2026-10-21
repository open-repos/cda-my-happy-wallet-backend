import { CursorPage, PaginationRequest } from "../../pagination";
import {
  MonthlyEvent,
  MonthlyEventOccurrence,
  MonthlyEventProps,
  MonthlyEventStatus,
  BudgetScenario,
} from "../domain/MonthlyEvent";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { MonthlyEventRepository } from "./MonthlyEventRepository";

export class MonthlyEventApplicationError extends Error {
  public constructor(
    public readonly code:
      | "EVENT_NOT_FOUND"
      | "INVALID_MONTH"
      | "INVALID_STATUS_TRANSITION"
      | "EXPIRED_POTENTIAL"
  ) {
    super(code);
    this.name = "MonthlyEventApplicationError";
  }
}

export type SaveMonthlyEventInput = Omit<MonthlyEventProps, "id" | "ownerId">;

export class MonthlyEventUseCases {
  public constructor(
    private readonly repository: MonthlyEventRepository,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public list(
    ownerId: number,
    page: PaginationRequest,
    status: MonthlyEventStatus = "CONFIRME"
  ): Promise<CursorPage<MonthlyEvent>> {
    return this.repository.listByOwner(ownerId, page, status);
  }

  public occurrences(
    ownerId: number,
    month: string,
    page: PaginationRequest,
    scenario: BudgetScenario = "standard"
  ): Promise<CursorPage<MonthlyEventOccurrence>> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new MonthlyEventApplicationError("INVALID_MONTH");
    }
    return this.repository.listOccurrences(ownerId, month, page, scenario);
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
    const event = MonthlyEvent.create({ ...input, ownerId });
    this.assertNotExpired(event);
    return this.repository.create(event);
  }

  public async update(
    ownerId: number,
    id: number,
    input: SaveMonthlyEventInput
  ): Promise<MonthlyEvent> {
    const existing = await this.get(ownerId, id);
    if (input.status !== undefined && input.status !== existing.status)
      throw new MonthlyEventApplicationError("INVALID_STATUS_TRANSITION");
    const updated = MonthlyEvent.create({
      ...input,
      id,
      ownerId,
      status: existing.status,
    });
    this.assertNotExpired(updated);
    const event = await this.repository.update(updated);
    if (event == null)
      throw new MonthlyEventApplicationError("EVENT_NOT_FOUND");
    return event;
  }

  public async delete(ownerId: number, id: number): Promise<void> {
    if (!(await this.repository.delete(id, ownerId))) {
      throw new MonthlyEventApplicationError("EVENT_NOT_FOUND");
    }
  }

  public async confirm(ownerId: number, id: number): Promise<MonthlyEvent> {
    const event = await this.repository.confirm(id, ownerId);
    if (event === null)
      throw new MonthlyEventApplicationError("EVENT_NOT_FOUND");
    return event;
  }

  public clearPotential(ownerId: number): Promise<void> {
    return this.repository.clearPotential(ownerId);
  }

  private assertNotExpired(event: MonthlyEvent): void {
    if (event.isExpired(this.today()))
      throw new MonthlyEventApplicationError("EXPIRED_POTENTIAL");
  }
}
