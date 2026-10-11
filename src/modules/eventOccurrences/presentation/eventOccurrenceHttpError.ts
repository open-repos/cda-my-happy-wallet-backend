import { ErrorCode, ErrorException } from "../../../utils/errors";
import { OneOffOperationError } from "../../operations/domain";
import { OccurrenceResolutionError } from "../domain";

export const toEventOccurrenceHttpError = (error: unknown): Error => {
  if (error instanceof ErrorException) return error;
  if (error instanceof OccurrenceResolutionError) {
    switch (error.code) {
      case "EVENT_NOT_FOUND":
      case "OCCURRENCE_NOT_FOUND":
      case "CATEGORY_NOT_FOUND":
        return new ErrorException(ErrorCode.NotFound);
      case "OCCURRENCE_ALREADY_RESOLVED":
      case "PERIOD_CLOSED":
        return new ErrorException(ErrorCode.Conflict, "Occurrence conflict", {
          code: error.code,
        });
    }
  }
  if (error instanceof OneOffOperationError) {
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Operation data is invalid",
      { code: error.code }
    );
  }
  return error instanceof Error
    ? error
    : new Error("Unknown event occurrence error");
};
