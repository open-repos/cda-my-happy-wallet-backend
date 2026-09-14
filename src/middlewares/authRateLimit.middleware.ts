import { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { ErrorCode, ErrorException } from "../utils/errors";

type AuthRateLimiterOptions = {
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
};

const MINUTE_MS = 60 * 1000;

export const createAuthRateLimiter = ({
  windowMs,
  limit,
  skipSuccessfulRequests = false,
}: AuthRateLimiterOptions) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (_: Request, __: Response, next: NextFunction) =>
      next(new ErrorException(ErrorCode.TooManyRequests)),
  });

export const loginRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 10,
  skipSuccessfulRequests: true,
});

export const registrationRateLimiter = createAuthRateLimiter({
  windowMs: 60 * MINUTE_MS,
  limit: 5,
});

export const passwordResetRateLimiter = createAuthRateLimiter({
  windowMs: 60 * MINUTE_MS,
  limit: 5,
});

export const passwordChangeRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 5,
});

export const tokenValidationRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 20,
});

export const refreshRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 30,
});
