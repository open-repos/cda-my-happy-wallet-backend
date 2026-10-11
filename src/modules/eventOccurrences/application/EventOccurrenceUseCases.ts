import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
import { BudgetPeriodRepository } from "../../budgetPeriods/application";
import { MonthlyEventRepository } from "../../monthlyEvents/application";
import { OperationCategoryRepository } from "../../operations/application";
import { OneOffOperation } from "../../operations/domain";
import {
  OccurrenceResolution,
  OccurrenceResolutionError,
  OccurrenceSnapshot,
} from "../domain";
import {
  OccurrenceResolutionConflict,
  OccurrenceResolutionRepository,
} from "./OccurrenceResolutionRepository";

export type RealizeOccurrenceInput = Readonly<{
  categoryId: number;
  title?: string;
  amount?: string | number;
  operationDate?: string;
}>;

export type OccurrenceResolutionResult = Readonly<{
  resolution: OccurrenceResolution;
  /** Vrai lorsqu'une commande identique avait déjà réussi. */
  replayed: boolean;
}>;

type PeriodReader = Pick<BudgetPeriodRepository, "find">;

export class EventOccurrenceUseCases {
  public constructor(
    private readonly events: Pick<MonthlyEventRepository, "findById">,
    private readonly categories: Pick<OperationCategoryRepository, "findById">,
    private readonly periods: PeriodReader,
    private readonly resolutions: OccurrenceResolutionRepository,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async realize(
    ownerId: number,
    eventId: number,
    occurrenceDate: string,
    input: RealizeOccurrenceInput
  ): Promise<OccurrenceResolutionResult> {
    const existing = await this.resolutions.find(
      ownerId,
      eventId,
      occurrenceDate
    );
    const snapshot =
      existing ?? (await this.snapshot(ownerId, eventId, occurrenceDate));
    const category = await this.categories.findById(input.categoryId, ownerId);
    if (category == null) {
      throw new OccurrenceResolutionError("CATEGORY_NOT_FOUND");
    }
    const operation = OneOffOperation.create({
      ownerId,
      title: input.title ?? snapshot.title,
      amount: input.amount ?? (snapshot.minorUnits / 100).toFixed(2),
      currency: snapshot.currency,
      kind: snapshot.kind,
      operationDate: input.operationDate ?? occurrenceDate,
      category: { id: category.id, ownerId: category.ownerId },
    });

    if (existing != null) return this.replayRealization(existing, operation);

    await this.assertPeriodOpen(
      ownerId,
      operation.operationDate,
      snapshot.currency
    );
    try {
      return {
        resolution: await this.resolutions.realize(snapshot, operation),
        replayed: false,
      };
    } catch (error) {
      if (!(error instanceof OccurrenceResolutionConflict)) throw error;
      const winner = await this.resolutions.find(
        ownerId,
        eventId,
        occurrenceDate
      );
      if (winner == null) throw error;
      return this.replayRealization(winner, operation);
    }
  }

  public async cancel(
    ownerId: number,
    eventId: number,
    occurrenceDate: string
  ): Promise<OccurrenceResolutionResult> {
    const existing = await this.resolutions.find(
      ownerId,
      eventId,
      occurrenceDate
    );
    if (existing != null) return this.replayCancellation(existing);

    const snapshot = await this.snapshot(ownerId, eventId, occurrenceDate);
    try {
      return {
        resolution: await this.resolutions.cancel(snapshot),
        replayed: false,
      };
    } catch (error) {
      if (!(error instanceof OccurrenceResolutionConflict)) throw error;
      const winner = await this.resolutions.find(
        ownerId,
        eventId,
        occurrenceDate
      );
      if (winner == null) throw error;
      return this.replayCancellation(winner);
    }
  }

  private async snapshot(
    ownerId: number,
    eventId: number,
    occurrenceDate: string
  ): Promise<OccurrenceSnapshot> {
    const event = await this.events.findById(eventId, ownerId);
    if (event == null) throw new OccurrenceResolutionError("EVENT_NOT_FOUND");
    if (
      !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(occurrenceDate) ||
      event.occurrenceIn(occurrenceDate.slice(0, 7)) !== occurrenceDate
    ) {
      throw new OccurrenceResolutionError("OCCURRENCE_NOT_FOUND");
    }
    return {
      ownerId,
      sourceEventId: eventId,
      occurrenceDate,
      title: event.title,
      minorUnits: event.minorUnits,
      currency: event.currency,
      kind: event.kind,
    };
  }

  /** Une période passée est logiquement clôturée, même avant sa matérialisation. */
  private async assertPeriodOpen(
    ownerId: number,
    operationDate: string,
    currency: string
  ): Promise<void> {
    const month = operationDate.slice(0, 7);
    if (month < this.today().slice(0, 7)) {
      throw new OccurrenceResolutionError("PERIOD_CLOSED");
    }
    const period = await this.periods.find(ownerId, month, currency);
    if (period?.status === "CLOSED") {
      throw new OccurrenceResolutionError("PERIOD_CLOSED");
    }
  }

  private replayRealization(
    existing: OccurrenceResolution,
    command: OneOffOperation
  ): OccurrenceResolutionResult {
    const operation = existing.operation;
    if (
      existing.status !== "REALIZED" ||
      operation == null ||
      operation.title !== command.title ||
      operation.minorUnits !== command.money.minorUnits ||
      operation.operationDate !== command.operationDate ||
      operation.categoryId !== command.categoryId
    ) {
      throw new OccurrenceResolutionError("OCCURRENCE_ALREADY_RESOLVED");
    }
    return { resolution: existing, replayed: true };
  }

  private replayCancellation(
    existing: OccurrenceResolution
  ): OccurrenceResolutionResult {
    if (existing.status !== "CANCELED") {
      throw new OccurrenceResolutionError("OCCURRENCE_ALREADY_RESOLVED");
    }
    return { resolution: existing, replayed: true };
  }
}
