import { ErrorCode, ErrorException } from "../../../utils/errors";
import { ReconciliationError } from "../domain/Reconciliation";
export function reconciliationHttpError(error: unknown): Error {
  if (error instanceof ReconciliationError) {
    const code = error.code;
    const type =
      code === "NOT_FOUND"
        ? ErrorCode.NotFound
        : [
            "PERIOD_CLOSED",
            "ASSOCIATION_CONFLICT",
            "ARCHIVED_ENVELOPE",
            "RETRY_CONFLICT",
            "LINKED_OPERATION_INCOMPATIBLE",
          ].includes(code)
        ? ErrorCode.Conflict
        : ErrorCode.ValidationFailed;
    return new ErrorException(type, "Reconciliation request failed", { code });
  }
  return error instanceof Error
    ? error
    : new Error("Unknown reconciliation error");
}
