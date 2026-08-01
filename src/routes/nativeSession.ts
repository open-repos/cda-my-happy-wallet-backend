import { NextFunction, Request, Response, Router } from "express";
import {
  loginRateLimiter,
  refreshRateLimiter,
} from "../middlewares/authRateLimit.middleware";
import { Validator } from "../middlewares/validator.middleware";
import {
  NativeSessionController,
  nativeSessionController,
} from "../modules/auth/nativeSession";

export const createNativeSessionRouter = (
  controller: NativeSessionController
): Router => {
  const router = Router();

  router.post(
    "/sessions",
    loginRateLimiter,
    Validator("login"),
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(controller.create(req, res)).catch(next)
  );
  router.post(
    "/sessions/refresh",
    refreshRateLimiter,
    Validator("nativeRefreshSession"),
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(controller.refresh(req, res)).catch(next)
  );
  router.post(
    "/sessions/revoke",
    refreshRateLimiter,
    Validator("nativeRefreshSession"),
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(controller.revoke(req, res)).catch(next)
  );

  return router;
};

export const nativeSessionRouter = createNativeSessionRouter(
  nativeSessionController
);

export const swNativeSessionRouter = {
  "/auth/native/sessions": {
    post: {
      tags: ["Users"],
      summary: "Create a native application session",
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/Login" } },
        },
      },
      responses: { "200": { description: "Native session created" } },
    },
  },
  "/auth/native/sessions/refresh": {
    post: {
      tags: ["Users"],
      summary: "Rotate a native application session",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/NativeRefreshSession" },
          },
        },
      },
      responses: { "200": { description: "Native session rotated" } },
    },
  },
  "/auth/native/sessions/revoke": {
    post: {
      tags: ["Users"],
      summary: "Revoke a native application session",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/NativeRefreshSession" },
          },
        },
      },
      responses: { "204": { description: "Native session revoked" } },
    },
  },
};
