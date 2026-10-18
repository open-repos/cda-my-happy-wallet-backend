import { ErrorCode, ErrorException } from "../../../utils/errors";
import { BudgetPeriodEngineError } from "../application";
import { BudgetPeriodError } from "../domain";

export const toBudgetPeriodHttpError = (error: unknown): Error => {
  if (error instanceof ErrorException) return error;
  if (
    error instanceof BudgetPeriodError ||
    error instanceof BudgetPeriodEngineError
  ) {
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Budget period request is invalid",
      { code: error.code }
    );
  }
  return error instanceof Error
    ? error
    : new Error("Unknown budget period error");
};
