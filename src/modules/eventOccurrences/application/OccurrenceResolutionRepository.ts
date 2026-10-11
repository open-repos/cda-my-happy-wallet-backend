import { OneOffOperation } from "../../operations/domain";
import { CursorPage, PaginationRequest } from "../../pagination";
import {
  OccurrenceResolution,
  OccurrenceSnapshot,
  PendingOccurrence,
} from "../domain";

/** Levée lorsqu'une décision concurrente occupe déjà l'occurrence. */
export class OccurrenceResolutionConflict extends Error {
  public constructor() {
    super("OCCURRENCE_RESOLUTION_CONFLICT");
    this.name = "OccurrenceResolutionConflict";
  }
}

export interface OccurrenceResolutionRepository {
  find(
    ownerId: number,
    sourceEventId: number,
    occurrenceDate: string
  ): Promise<OccurrenceResolution | null>;
  /** Crée l'opération et la résolution dans une seule transaction. */
  realize(
    snapshot: OccurrenceSnapshot,
    operation: OneOffOperation
  ): Promise<OccurrenceResolution>;
  cancel(snapshot: OccurrenceSnapshot): Promise<OccurrenceResolution>;
  /** Occurrences sans décision entre deux dates civiles incluses, par date puis règle. */
  listPending(
    ownerId: number,
    from: string,
    through: string,
    page: PaginationRequest
  ): Promise<CursorPage<PendingOccurrence>>;
}
