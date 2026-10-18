import { NextFunction, Request, Response } from "express";
import { rateLimit, Store } from "express-rate-limit";
import { ErrorCode, ErrorException } from "../utils/errors";
import { createRedisRateLimitStore } from "../infrastructure/rateLimit/redisRateLimitStore";

type AuthRateLimiterOptions = {
  windowMs: number;
  limit: number;
  skipSuccessfulRequests?: boolean;
  store?: Store;
  storePrefix?: string;
};

const MINUTE_MS = 60 * 1000;

export const createAuthRateLimiter = ({
  windowMs,
  limit,
  skipSuccessfulRequests = false,
  store,
  storePrefix,
}: AuthRateLimiterOptions) => {
  const selectedStore =
    store ?? (storePrefix ? createRedisRateLimitStore(storePrefix) : undefined);

  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests,
    ...(selectedStore ? { store: selectedStore } : {}),
    passOnStoreError: false,
    handler: (_: Request, __: Response, next: NextFunction) =>
      next(new ErrorException(ErrorCode.TooManyRequests)),
  });
};

export const loginRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 10,
  skipSuccessfulRequests: true,
  storePrefix: "login",
});

export const registrationRateLimiter = createAuthRateLimiter({
  windowMs: 60 * MINUTE_MS,
  limit: 5,
  storePrefix: "registration",
});

export const passwordResetRateLimiter = createAuthRateLimiter({
  windowMs: 60 * MINUTE_MS,
  limit: 5,
  storePrefix: "password-reset",
});

export const passwordChangeRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 5,
  storePrefix: "password-change",
});

export const tokenValidationRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 20,
  storePrefix: "token-validation",
});

export const refreshRateLimiter = createAuthRateLimiter({
  windowMs: 15 * MINUTE_MS,
  limit: 30,
  storePrefix: "refresh",
});
