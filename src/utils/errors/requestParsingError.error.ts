import { ErrorCode } from "./errorCode.error";
import { ErrorException } from "./errorException.error";

type RequestParsingError = Error & {
  status?: number;
  type?: string;
};

export const normalizeRequestParsingError = (error: Error): Error => {
  if (error instanceof ErrorException) {
    return error;
  }

  const parsingError = error as RequestParsingError;
  if (
    parsingError.status === 413 ||
    parsingError.type === "entity.too.large" ||
    parsingError.type === "parameters.too.many"
  ) {
    return new ErrorException(ErrorCode.PayloadTooLarge);
  }

  if (
    parsingError.status === 400 &&
    parsingError.type === "entity.parse.failed"
  ) {
    return new ErrorException(ErrorCode.IncompleteRequestBody);
  }

  return error;
};
