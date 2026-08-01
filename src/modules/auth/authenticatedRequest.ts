import { Request } from "express";
import { ErrorCode, ErrorException } from "../../utils/errors";

export const getAuthenticatedUserId = (req: Request): string => {
  if (req.user == null) {
    throw new ErrorException(ErrorCode.Unauthenticated);
  }

  return req.user.id.toString();
};
