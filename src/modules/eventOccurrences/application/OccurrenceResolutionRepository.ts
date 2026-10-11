import { OneOffOperation } from "../../operations/domain";
import { OccurrenceResolution, OccurrenceSnapshot } from "../domain";

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
}
