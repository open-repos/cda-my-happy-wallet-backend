import { CursorPage, PaginationRequest } from "../../pagination";
import { OccurrenceResolution } from "../domain";

/** Read interface segregated from occurrence mutations. */
export interface OccurrenceResolutionReader {
  listResolved(
    ownerId: number,
    from: string,
    to: string,
    page: PaginationRequest
  ): Promise<CursorPage<OccurrenceResolution>>;
}
export class ListOccurrenceResolutions {
  public constructor(private readonly reader: OccurrenceResolutionReader) {}
  public execute(
    ownerId: number,
    from: string,
    to: string,
    page: PaginationRequest
  ): Promise<CursorPage<OccurrenceResolution>> {
    return this.reader.listResolved(ownerId, from, to, page);
  }
}
