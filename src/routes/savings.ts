import { ReconciliationError } from "../modules/reconciliation/domain/Reconciliation";
import { toBudgetPeriodHttpError } from "../modules/budgetPeriods/presentation/budgetPeriodHttpError";
import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import Joi from "joi";
import { prisma } from "../database";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { getAuthenticatedUserId } from "../modules/auth/authenticatedRequest";
import { parseGoalId } from "../modules/financialGoals/presentation/financialGoalValidators";
import { parsePaginationRequest } from "../modules/pagination";
import { SavingsRepository } from "../modules/savings/application/SavingsRepository";
import { isCivilDate, SavingsError } from "../modules/savings/domain/Savings";
import { PrismaSavingsRepository } from "../modules/savings/infrastructure/PrismaSavingsRepository";
import { PrismaCurrentAccount } from "../modules/savings/infrastructure/PrismaCurrentAccount";
import { ErrorCode, ErrorException } from "../utils/errors";
import { CivilDateClock, parisCivilDateClock } from "../utils/civilDateClock";

const minor = Joi.number().integer().min(0).max(9999999999).strict();
const name = Joi.string().trim().min(2).max(50);
const currency = Joi.string()
  .trim()
  .pattern(/^[a-zA-Z]{3}$/)
  .uppercase();
const createBody = Joi.object({
  name: name.required(),
  currency: currency.required(),
  initialBalanceMinorUnits: minor.default(0),
}).unknown(false);
const updateBody = Joi.object({
  name,
  archived: Joi.boolean().valid(true).strict(),
})
  .min(1)
  .unknown(false);
const transferBody = Joi.object({
  direction: Joi.string().valid("TO_SAVINGS", "FROM_SAVINGS").required(),
  amountMinorUnits: minor.min(1).required(),
  operationDate: Joi.string().required(),
  reason: Joi.string()
    .valid("MANUAL", "MONTH_END", "NEGATIVE_COVERAGE")
    .default("MANUAL"),
  idempotencyKey: Joi.string()
    .pattern(/^[A-Za-z0-9:_-]{8,100}$/)
    .required(),
}).unknown(false);
const linkBody = Joi.object({
  goalId: Joi.number().integer().positive().strict().required(),
}).unknown(false);
const resolutionBody = Joi.object({
  status: Joi.string().valid("CONFIRMED", "CANCELED").required(),
}).unknown(false);
export const toSavingsHttpError = (error: unknown): Error => {
  if (error instanceof ReconciliationError && error.code === "NOT_FOUND")
    return new ErrorException(
      ErrorCode.NotFound,
      "Savings owner no longer exists",
      { code: "NOT_FOUND" }
    );
  if (Joi.isError(error))
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Invalid savings request",
      { code: "INVALID_REQUEST" }
    );
  if (error instanceof SavingsError) {
    const type =
      error.code === "NOT_FOUND"
        ? ErrorCode.NotFound
        : error.code.startsWith("INVALID_")
        ? ErrorCode.ValidationFailed
        : ErrorCode.Conflict;
    return new ErrorException(type, "Savings request could not be completed", {
      code: error.code,
    });
  }
  return toBudgetPeriodHttpError(error);
};

export function createSavingsRouter(
  repository: SavingsRepository,
  current: Pick<PrismaCurrentAccount, "summary" | "history">,
  authenticate: RequestHandler = tokenJwtTAuth,
  today: CivilDateClock = parisCivilDateClock
) {
  const router = Router();
  const owner = (req: Request) => Number(getAuthenticatedUserId(req));
  const id = (req: Request) => parseGoalId(req.params.id);
  const filteredPagination = (req: Request) => {
    const values = { ...req.query };
    delete values.month;
    delete values.currency;
    return parsePaginationRequest(values);
  };
  const query = (req: Request) => {
    const value = Joi.object({
      month: Joi.string().default(today().slice(0, 7)),
      currency: currency.default("EUR"),
    }).validate({ month: req.query.month, currency: req.query.currency });
    if (value.error || !isCivilDate(`${value.value.month}-01`))
      throw new SavingsError("INVALID_DATE");
    return value.value as { month: string; currency: string };
  };
  const handle =
    (
      action: (req: Request, res: Response) => Promise<unknown>
    ): RequestHandler =>
    (req, res, next: NextFunction) => {
      Promise.resolve(action(req, res)).catch((error) =>
        next(toSavingsHttpError(error))
      );
    };
  router.get(
    "/savings-accounts",
    authenticate,
    handle(async (req, res) =>
      res.json(
        await repository.list(owner(req), parsePaginationRequest(req.query))
      )
    )
  );
  router.post(
    "/savings-accounts",
    authenticate,
    handle(async (req, res) =>
      res.status(201).json({
        data: await repository.create(
          owner(req),
          await createBody.validateAsync(req.body)
        ),
      })
    )
  );
  router.get(
    "/savings-accounts/:id",
    authenticate,
    handle(async (req, res) =>
      res.json({ data: await repository.get(owner(req), id(req)) })
    )
  );
  router.patch(
    "/savings-accounts/:id",
    authenticate,
    handle(async (req, res) =>
      res.json({
        data: await repository.update(
          owner(req),
          id(req),
          await updateBody.validateAsync(req.body)
        ),
      })
    )
  );
  router.put(
    "/savings-accounts/:id/goal",
    authenticate,
    handle(async (req, res) => {
      const { goalId } = await linkBody.validateAsync(req.body);
      return res.json({
        data: await repository.linkGoal(owner(req), id(req), goalId),
      });
    })
  );
  router.post(
    "/savings-accounts/:id/transfers",
    authenticate,
    handle(async (req, res) =>
      res.status(201).json({
        data: await repository.transfer(
          owner(req),
          id(req),
          await transferBody.validateAsync(req.body)
        ),
      })
    )
  );
  router.get(
    "/savings-accounts/:id/movements",
    authenticate,
    handle(async (req, res) =>
      res.json(
        await repository.history(
          owner(req),
          id(req),
          parsePaginationRequest(req.query)
        )
      )
    )
  );
  router.get(
    "/savings-occurrences/pending",
    authenticate,
    handle(async (req, res) => {
      const { month, currency } = query(req);
      return res.json(
        await repository.pending(
          owner(req),
          month,
          currency,
          filteredPagination(req)
        )
      );
    })
  );
  router.put(
    "/savings-accounts/:id/occurrences/:month",
    authenticate,
    handle(async (req, res) => {
      if (
        !/^\d{4}-\d{2}$/.test(req.params.month) ||
        !isCivilDate(`${req.params.month}-01`)
      )
        throw new SavingsError("INVALID_DATE");
      const { status } = await resolutionBody.validateAsync(req.body);
      return res.json({
        data: await repository.resolve(
          owner(req),
          id(req),
          req.params.month,
          status
        ),
      });
    })
  );
  router.get(
    "/accounts/current",
    authenticate,
    handle(async (req, res) => {
      const { month, currency } = query(req);
      if (month > today().slice(0, 7)) throw new SavingsError("INVALID_DATE");
      return res.json({
        data: await current.summary(owner(req), month, currency, today()),
      });
    })
  );
  router.get(
    "/accounts/current/movements",
    authenticate,
    handle(async (req, res) => {
      const { month, currency } = query(req);
      return res.json(
        await current.history(
          owner(req),
          month,
          currency,
          filteredPagination(req)
        )
      );
    })
  );
  return router;
}
export const savingsRouter = createSavingsRouter(
  new PrismaSavingsRepository(prisma),
  new PrismaCurrentAccount(prisma)
);
