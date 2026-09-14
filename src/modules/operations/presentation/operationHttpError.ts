import { ErrorCode, ErrorException } from "../../../utils/errors";
import { OneOffOperationError } from "../domain";
import { OperationApplicationError } from "../application";

export const toOperationHttpError = (error: unknown): Error => {
  if (error instanceof ErrorException) return error;

  if (error instanceof OneOffOperationError) {
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Operation data is invalid",
      { code: error.code }
    );
  }

  if (error instanceof OperationApplicationError) {
    switch (error.code) {
      case "OPERATION_NOT_FOUND":
      case "CATEGORY_NOT_FOUND":
        return new ErrorException(ErrorCode.NotFound);
      case "CATEGORY_NAME_CONFLICT":
      case "CATEGORY_IN_USE":
        return new ErrorException(ErrorCode.Conflict, "Resource conflict", {
          code: error.code,
        });
      case "INVALID_CATEGORY_NAME":
      case "INVALID_CATEGORY_COLOR":
        return new ErrorException(
          ErrorCode.ValidationFailed,
          "Category data is invalid",
          { code: error.code }
        );
    }
  }

  return error instanceof Error ? error : new Error("Unknown operation error");
};
