import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { prisma } from "../database";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { getAuthenticatedUserId } from "../modules/auth/authenticatedRequest";
import { MonthEndError } from "../modules/monthEnd/domain/MonthEnd";
import { PrismaMonthEndRepository } from "../modules/monthEnd/infrastructure/PrismaMonthEndRepository";
import { ErrorCode, ErrorException } from "../utils/errors";
import { toSavingsHttpError } from "./savings";

export function createMonthEndRouter(
  repository: Pick<PrismaMonthEndRepository, "get" | "put">,
  authenticate: RequestHandler = tokenJwtTAuth
) {
  const router = Router();
  const handle =
    (
      action: (
        req: Request,
        res: Response,
        owner: number,
        currency: string
      ) => Promise<unknown>
    ): RequestHandler =>
    (req, res, next: NextFunction) => {
      Promise.resolve()
        .then(() => {
          if (
            Object.keys(req.query).some((key) => key !== "currency") ||
            (req.query.currency !== undefined &&
              typeof req.query.currency !== "string")
          )
            throw new MonthEndError("INVALID_CURRENCY");
          return action(
            req,
            res,
            Number(getAuthenticatedUserId(req)),
            String(req.query.currency ?? "EUR")
              .trim()
              .toUpperCase()
          );
        })
        .catch((error: unknown) => {
          if (error instanceof MonthEndError) {
            const type =
              error.code.startsWith("INVALID_") ||
              error.code === "ALLOCATION_EXCEEDS_RESULT"
                ? ErrorCode.ValidationFailed
                : ErrorCode.Conflict;
            next(
              new ErrorException(
                type,
                "Month-end decision could not be completed",
                { code: error.code }
              )
            );
          } else next(toSavingsHttpError(error));
        });
    };
  router.get(
    "/budget-periods/:month/decision",
    authenticate,
    handle(async (req, res, owner, currency) =>
      res.json({
        data: await repository.get(owner, req.params.month, currency),
      })
    )
  );
  router.put(
    "/budget-periods/:month/decision",
    authenticate,
    handle(async (req, res, owner, currency) =>
      res.json({
        data: await repository.put(owner, req.params.month, currency, req.body),
      })
    )
  );
  return router;
}
export const monthEndRouter = createMonthEndRouter(
  new PrismaMonthEndRepository(prisma)
);
