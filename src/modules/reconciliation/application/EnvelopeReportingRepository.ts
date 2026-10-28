import { CursorPage, PaginationRequest } from "../../pagination";
import { analyzeEnvelopeMonths } from "../domain/EnvelopeAnalysis";
export type ReportingQuery = { from: string; to: string; currency: string };
export interface EnvelopeReportingRepository {
  overview(
    owner: number,
    query: ReportingQuery,
    page: PaginationRequest
  ): Promise<CursorPage<Record<string, unknown>>>;
  analytics(
    owner: number,
    query: ReportingQuery,
    page: PaginationRequest
  ): Promise<
    CursorPage<{
      id: number;
      category: Record<string, unknown> | null;
      statistics: ReturnType<typeof analyzeEnvelopeMonths>;
      months: readonly Record<string, unknown>[];
    }>
  >;
  fixedMonth(
    owner: number,
    month: string,
    page: PaginationRequest
  ): Promise<CursorPage<Record<string, unknown>>>;
}
