import { Request, Response, NextFunction } from 'express';
import { ErrorException,ErrorCode } from '../utils/errors';
import { normalizePrismaError } from '../utils/errors/prismaError.error';
import { createErrorResponse } from '../utils/errors/errorResponse.error';
import { normalizeRequestParsingError } from '../utils/errors/requestParsingError.error';
import { NODE_ENV } from '../config/config';

export const errorHandler = (err: Error, req: Request, res: Response, _: NextFunction) => {
  const normalizedError = normalizePrismaError(
    normalizeRequestParsingError(err)
  );

  if (!(normalizedError instanceof ErrorException)) {
    if (NODE_ENV === "development") {
      console.error("Unhandled application error", normalizedError);
    } else {
      console.error("Unhandled application error", {
        type: normalizedError.name,
        method: req.method,
        route: req.route?.path || "unmatched",
        statusCode: 500,
      });
    }
  }

  const applicationError = normalizedError instanceof ErrorException
    ? normalizedError
    : new ErrorException(ErrorCode.UnknownError);

  return res
    .status(applicationError.status)
    .json(createErrorResponse(applicationError, req.path));
};
