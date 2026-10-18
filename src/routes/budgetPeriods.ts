import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import {
  BudgetPeriodController,
  budgetPeriodController,
  toBudgetPeriodHttpError,
} from "../modules/budgetPeriods";
import {
  paginatedCollectionResponse,
  paginationParameters,
} from "../utils/paginationSwagger";

type Action = (req: Request, res: Response) => Promise<Response>;
const handle =
  (action: Action): RequestHandler =>
  (req, res, next: NextFunction) =>
    Promise.resolve(action(req, res)).catch((error) =>
      next(toBudgetPeriodHttpError(error))
    );

export const createBudgetPeriodRouter = (
  controller: BudgetPeriodController,
  authenticate: RequestHandler = tokenJwtTAuth
): Router => {
  const router = Router();
  router.get(
    "/budget-periods/history",
    authenticate,
    handle((req, res) => controller.history(req, res))
  );
  router.get(
    "/budget-periods/:month/summary",
    authenticate,
    handle((req, res) => controller.summary(req, res))
  );
  return router;
};

export const budgetPeriodRouter = createBudgetPeriodRouter(
  budgetPeriodController
);

const currencyParameter = {
  name: "currency",
  in: "query",
  required: true,
  schema: { type: "string", minLength: 3, maxLength: 3, example: "EUR" },
};
const securedResponses = {
  "401": { description: "Missing or invalid access token" },
  "422": {
    description:
      "Invalid month, currency, pagination or future period (code FUTURE_PERIOD)",
  },
};

export const swBudgetPeriodRouter = {
  "/budget-periods/{month}/summary": {
    get: {
      tags: ["ResteAVivre"],
      summary: "Monthly real and forecast budget with at most 31 daily points",
      description:
        "A past month is closed on first read and returns forecast=null. Future months are refused.",
      security: [{ accessToken_auth: [] }],
      parameters: [
        {
          name: "month",
          in: "path",
          required: true,
          schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        },
        currencyParameter,
      ],
      responses: {
        "200": { description: "Budget summary of the authenticated user" },
        ...securedResponses,
      },
    },
  },
  "/budget-periods/history": {
    get: {
      tags: ["ResteAVivre"],
      summary: "Closed monthly balances, newest first",
      security: [{ accessToken_auth: [] }],
      parameters: [currencyParameter, ...paginationParameters],
      responses: {
        "200": paginatedCollectionResponse("Paginated closed periods"),
        ...securedResponses,
      },
    },
  },
};
