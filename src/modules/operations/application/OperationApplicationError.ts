export type OperationApplicationErrorCode =
  | "OPERATION_NOT_FOUND"
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_NAME_CONFLICT"
  | "CATEGORY_IN_USE"
  | "INVALID_CATEGORY_NAME"
  | "INVALID_CATEGORY_COLOR";

export class OperationApplicationError extends Error {
  public constructor(public readonly code: OperationApplicationErrorCode) {
    super(code);
    this.name = "OperationApplicationError";
  }
}
