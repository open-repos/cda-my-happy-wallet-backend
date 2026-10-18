import { ErrorCode, ErrorException } from "../../../utils/errors";
import { MonthlyEventApplicationError } from "../application";
import { MonthlyEventError } from "../domain";

export const toMonthlyEventHttpError = (error: unknown): Error => {
  if (error instanceof ErrorException) return error;
  if (error instanceof MonthlyEventError) {
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Monthly event data is invalid",
      { code: error.code }
    );
  }
  if (error instanceof MonthlyEventApplicationError) {
    if (error.code === "EVENT_NOT_FOUND") {
      return new ErrorException(ErrorCode.NotFound);
    }
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Month parameter is invalid"
    );
  }
  return error instanceof Error
    ? error
    : new Error("Unknown monthly event error");
};
