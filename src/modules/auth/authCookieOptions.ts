import { CookieOptions, Response } from "express";
import { NODE_ENV } from "../../config/config";

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

export const clearAuthCookie = (res: Response, name: string): void => {
  res.clearCookie(name, baseAuthCookieOptions);
};
