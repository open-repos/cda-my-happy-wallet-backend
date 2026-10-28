import { CursorPage, PaginationRequest } from "../../pagination";
import { Kind, SourceType, metrics } from "../domain/Reconciliation";

export type EnvelopeInput = {
  title: string;
  amount: string;
  currency: string;
  categoryId: number | null;
  startMonth: string;
  endMonth: string | null;
};
export type Envelope = EnvelopeInput & { id: number; archived: boolean };
export type Occurrence = {
  id: number;
  month: string;
  sourceType: SourceType;
  sourceId: number;
  title: string;
  currency: string;
  kind: Kind;
  referenceTotal: string;
  personalShare: string;
  categoryId: number | null;
  closed: boolean;
  operationCount: number;
  metrics: ReturnType<typeof metrics>;
};
export type Operation = {
  id: number;
  title: string;
  amount: string;
  currency: string;
  type: Kind;
  operationDate: string;
  categoryId: number;
  occurrenceId: number | null;
};
export type Eligibility = {
  id: number;
  title: string;
  currency: string | null;
  periodicity: string;
  eligible: boolean;
  reason: string;
};
export type ReconciliationSummary = {
  month: string;
  currency: string;
  closed: boolean;
  scope: "TRACKED_OCCURRENCES_AND_UNASSOCIATED_ACTUALS";
  actualIncome: string;
  actualExpense: string;
  unassociatedIncome: string;
  unassociatedExpense: string;
  trackedPlannedIncome: string;
  trackedPlannedExpense: string;
  projectedIncome: string;
  projectedExpense: string;
};
export interface ReconciliationRepository {
  getLink(
    owner: number,
    operationId: number
  ): Promise<{ operationId: number; occurrenceId: number | null }>;
  summary(
    owner: number,
    month: string,
    currency: string
  ): Promise<ReconciliationSummary>;
  listEnvelopes(
    owner: number,
    page: PaginationRequest,
    month?: string
  ): Promise<CursorPage<Envelope>>;
  getEnvelope(owner: number, id: number): Promise<Envelope>;
  saveEnvelope(
    owner: number,
    input: EnvelopeInput,
    id?: number
  ): Promise<Envelope>;
  archiveEnvelope(owner: number, id: number): Promise<void>;
  listOccurrences(
    owner: number,
    month: string,
    currency: string,
    page: PaginationRequest
  ): Promise<CursorPage<Occurrence>>;
  getOccurrence(owner: number, id: number): Promise<Occurrence>;
  updateOccurrence(
    owner: number,
    id: number,
    planned: string
  ): Promise<Occurrence>;
  listOperations(
    owner: number,
    id: number,
    unassociated: boolean,
    page: PaginationRequest
  ): Promise<CursorPage<Operation>>;
  link(
    owner: number,
    operationId: number,
    occurrenceId: number | null,
    expectedOccurrenceId: number | null
  ): Promise<void>;
  suggestions(
    owner: number,
    operationId: number,
    page: PaginationRequest
  ): Promise<CursorPage<Occurrence>>;
  eligibility(
    owner: number,
    page: PaginationRequest
  ): Promise<CursorPage<Eligibility>>;
}
