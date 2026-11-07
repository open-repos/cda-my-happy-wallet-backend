import { ReconciliationError } from "../../reconciliation/domain/Reconciliation";
import { SavingsError } from "../../savings/domain/Savings";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { FinancialGoalApplicationError } from "../application";
import { FinancialGoalError } from "../domain";

export const toFinancialGoalHttpError = (error: unknown): Error => {
  if (error instanceof ReconciliationError && error.code === "NOT_FOUND")
    return new ErrorException(ErrorCode.NotFound);
  if (error instanceof SavingsError)
    return new ErrorException(
      ErrorCode.Conflict,
      "Linked goal balance is read-only",
      { code: error.code }
    );
  if (error instanceof ErrorException) return error;
  if (error instanceof FinancialGoalError) {
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Financial goal data is invalid",
      { code: error.code }
    );
  }
  if (error instanceof FinancialGoalApplicationError) {
    return new ErrorException(ErrorCode.NotFound);
  }
  return error instanceof Error
    ? error
    : new Error("Unknown financial goal error");
};
