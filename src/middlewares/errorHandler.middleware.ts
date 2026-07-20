import { Request, Response, NextFunction } from 'express';
import { ErrorException,ErrorCode } from '../utils/errors';
import { normalizePrismaError } from '../utils/errors/prismaError.error';
import { createErrorResponse } from '../utils/errors/errorResponse.error';

export const errorHandler = (err: Error, req: Request, res: Response, _: NextFunction) => {
  const normalizedError = normalizePrismaError(err);

  if (!(normalizedError instanceof ErrorException)) {
    console.error("Unhandled application error", normalizedError);
  }

  const applicationError = normalizedError instanceof ErrorException
    ? normalizedError
    : new ErrorException(ErrorCode.UnknownError);

  return res
    .status(applicationError.status)
    .json(createErrorResponse(applicationError, req.path));
};
