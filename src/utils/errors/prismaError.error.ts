import { Prisma } from "@prisma/client";
import { ErrorCode } from "./errorCode.error";
import { ErrorException } from "./errorException.error";

export function isPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientValidationError
  );
}

export function normalizePrismaError(error: Error): Error {
  if (error instanceof ErrorException) {
    return error;
  }

  if (isPrismaError(error)) {
    return new ErrorException(ErrorCode.PrismaError);
  }

  return error;
}

export function toPrismaErrorException(
  error: unknown,
  message = ""
): ErrorException {
  if (error instanceof ErrorException) {
    return error;
  }

  return new ErrorException(ErrorCode.PrismaError, message);
}
