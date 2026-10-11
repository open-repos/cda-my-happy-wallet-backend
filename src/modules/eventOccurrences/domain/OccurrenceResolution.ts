import { MonthlyEventKind } from "../../monthlyEvents/domain";

export type OccurrenceResolutionStatus = "REALIZED" | "CANCELED";

/** Opération liée telle qu'elle existe encore; null si elle a été supprimée. */
export type RealizedOperation = Readonly<{
  id: number;
  title: string;
  minorUnits: number;
  operationDate: string;
  categoryId: number;
}>;

/** Instantané minimal de l'occurrence au moment de la décision. */
export type OccurrenceSnapshot = Readonly<{
  ownerId: number;
  sourceEventId: number;
  occurrenceDate: string;
  title: string;
  minorUnits: number;
  currency: string;
  kind: MonthlyEventKind;
}>;

export type OccurrenceResolution = OccurrenceSnapshot &
  Readonly<{
    id: number;
    status: OccurrenceResolutionStatus;
    operation: RealizedOperation | null;
    resolvedAt: Date;
  }>;

export type OccurrenceResolutionErrorCode =
  | "EVENT_NOT_FOUND"
  | "OCCURRENCE_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "OCCURRENCE_ALREADY_RESOLVED"
  | "PERIOD_CLOSED";

export class OccurrenceResolutionError extends Error {
  public constructor(public readonly code: OccurrenceResolutionErrorCode) {
    super(code);
    this.name = "OccurrenceResolutionError";
  }
}

/** Occurrence encore planifiée, proposée dans la file « à traiter ». */
export type PendingOccurrence = Readonly<{
  sourceEventId: number;
  occurrenceDate: string;
  title: string;
  minorUnits: number;
  currency: string;
  kind: MonthlyEventKind;
}>;

/** La file couvre le mois de `through` et les 11 mois précédents. */
export const PENDING_WINDOW_MONTHS = 12;
