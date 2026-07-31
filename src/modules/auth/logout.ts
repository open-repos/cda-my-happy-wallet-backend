import { NextFunction, Request, Response } from "express";
import { clearAuthCookie } from "./authCookieOptions";
import { refreshSessionService } from "./refreshSession";

export const logout = async (
  req: Request,
  res: Response,
  _: NextFunction
): Promise<Response> => {
  const refreshToken = req.cookies.refresh_token;

  if (typeof refreshToken === "string") {
    try {
      await refreshSessionService.revoke(refreshToken);
    } catch {
      // Logout remains idempotent for expired, legacy or already revoked tokens.
    }
  }

  clearAuthCookie(res, "refresh_token");
  clearAuthCookie(res, "id_user");
  return res.status(204).send();
};

export const swLogout = {
  tags: ["Users"],
  summary: "Revoke the current refresh session",
  operationId: "logoutUser",
  responses: {
    "204": {
      description: "Session revoked and authentication cookies cleared",
    },
  },
};
