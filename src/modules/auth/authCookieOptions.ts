import { CookieOptions, Response } from "express";
import { NODE_ENV } from "../../config/config";
import { REFRESH_TOKEN_TTL_SECONDS } from "./refreshSession/RefreshSessionService";

const baseAuthCookieOptions: CookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "strict",
  secure: NODE_ENV === "production",
};

export const authCookieOptions = (maxAge: number): CookieOptions => ({
  ...baseAuthCookieOptions,
  maxAge,
});

export const sessionCookieOptions = (
  expiresInSeconds: number = REFRESH_TOKEN_TTL_SECONDS
): CookieOptions => authCookieOptions(expiresInSeconds * 1000);

export const clearAuthCookie = (res: Response, name: string): void => {
  res.clearCookie(name, baseAuthCookieOptions);
};
