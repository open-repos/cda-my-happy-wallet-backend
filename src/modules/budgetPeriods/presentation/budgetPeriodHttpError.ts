import { ErrorCode, ErrorException } from "../../../utils/errors";
import { BudgetPeriodEngineError } from "../application";
import { BudgetPeriodError } from "../domain";
import { ReconciliationError } from "../../reconciliation/domain/Reconciliation";

export const toBudgetPeriodHttpError = (error: unknown): Error => {
  if (error instanceof ErrorException) return error;
  if (error instanceof ReconciliationError && error.code === "NOT_FOUND")
    return new ErrorException(
      ErrorCode.NotFound,
      "Budget owner no longer exists",
      { code: "NOT_FOUND" }
    );
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
