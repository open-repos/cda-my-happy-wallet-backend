
import { ErrorException,ErrorCode } from './../utils/errors/';
import { ACCESS_TOKEN_SECRET } from "../config/config";
import { Request, Response, NextFunction } from "express";
import { JsonWebTokenService } from "../modules/auth/token/JsonWebTokenService";
import { getAuthTokenPayload } from "../modules/auth/token/AuthTokenPayload";

const tokenService = new JsonWebTokenService();

export const tokenJwtTAuth = (
  req: Request,
  _: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader == null) {
    return next(new ErrorException(
      ErrorCode.AccessForbidden,
      "Access Forbidden . Error about headers"
    ));
  }

  const [scheme, token, extra] = authHeader.trim().split(/\s+/);
  if (scheme !== "Bearer" || !token || extra) {
    return next(new ErrorException(
      ErrorCode.Unauthorized,
      "The access token is not valid or is expired."
    ));
  }

  try {
    const decodedToken = tokenService.verify(token, ACCESS_TOKEN_SECRET as string);
    const user = getAuthTokenPayload(decodedToken);
    if (user == null) {
      throw new Error("Invalid access token payload");
    }

    req.user = user;
    return next();
  } catch {
    return next(new ErrorException(
      ErrorCode.Unauthorized,
      "The access token is not valid or is expired."
    ));
  }
};
