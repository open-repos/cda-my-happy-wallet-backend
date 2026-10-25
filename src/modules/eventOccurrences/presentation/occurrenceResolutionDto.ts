import { OccurrenceResolution } from "../domain";
/** Same snapshot and nullable current-operation link for reads and commands. */
export const occurrenceResolutionDto = (resolution: OccurrenceResolution) => ({
  eventId: resolution.sourceEventId,
  occurrenceDate: resolution.occurrenceDate,
  status: resolution.status,
  title: resolution.title,
  amount: (resolution.minorUnits / 100).toFixed(2),
  currency: resolution.currency,
  kind: resolution.kind,
  resolvedAt: resolution.resolvedAt.toISOString(),
  operation:
    resolution.operation === null
      ? null
      : {
          id: resolution.operation.id,
          title: resolution.operation.title,
          amount: (resolution.operation.minorUnits / 100).toFixed(2),
          operationDate: resolution.operation.operationDate,
          categoryId: resolution.operation.categoryId,
        },
});
