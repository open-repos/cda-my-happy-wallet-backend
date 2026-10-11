import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import {
  OperationAnalyticsController,
  operationAnalyticsController,
  toOperationAnalyticsHttpError,
} from "../modules/analytics";

type Action = (req: Request, res: Response) => Promise<Response>;
const handle =
  (action: Action): RequestHandler =>
  (req, res, next: NextFunction) =>
    Promise.resolve(action(req, res)).catch((error) =>
      next(toOperationAnalyticsHttpError(error))
    );

export const createAnalyticsRouter = (
  controller: OperationAnalyticsController,
  authenticate: RequestHandler = tokenJwtTAuth
): Router => {
  const router = Router();
  router.get(
    "/analytics/operations",
    authenticate,
    handle((req, res) => controller.operations(req, res))
  );
  return router;
};

export const analyticsRouter = createAnalyticsRouter(
  operationAnalyticsController
);

const queryParameter = (
  name: string,
  required: boolean,
  schema: Record<string, unknown>,
  description?: string
) => ({ name, in: "query", required, schema, description });

const amount = { type: "string", pattern: "^-?\\d+\\.\\d{2}$" };
const totals = {
  type: "object",
  required: ["key", "label", "color", "income", "expense", "net", "count"],
  properties: {
    key: { type: "string" },
    label: { type: "string", nullable: true },
    color: { type: "string", nullable: true },
    income: amount,
    expense: amount,
    net: amount,
    count: { type: "integer", minimum: 0 },
  },
};
const analyticsResponseSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        currency: { type: "string" },
        from: { type: "string", format: "date" },
        to: { type: "string", format: "date" },
        groupBy: { type: "string" },
        splitBy: { type: "string", nullable: true },
        kind: { type: "string", nullable: true },
        buckets: {
          type: "array",
          maxItems: 500,
          items: {
            ...totals,
            properties: {
              ...totals.properties,
              series: { type: "array", items: totals },
            },
          },
        },
      },
    },
  },
};

export const swAnalyticsRouter = {
  "/analytics/operations": {
    get: {
      tags: ["ResteAVivre"],
      summary: "Real operation totals grouped for charts",
      description:
        "Bounded aggregate of the authenticated user's operations. Time buckets are complete with zeros; ISO weeks are keyed by their Monday. Limits: 366 days, 156 weeks, 120 months (also for category and kind), 30 years and 500 points (buckets × series).",
      security: [{ accessToken_auth: [] }],
      parameters: [
        queryParameter("from", true, { type: "string", format: "date" }),
        queryParameter("to", true, { type: "string", format: "date" }),
        queryParameter("currency", true, {
          type: "string",
          minLength: 3,
          maxLength: 3,
          example: "EUR",
        }),
        queryParameter("groupBy", true, {
          type: "string",
          enum: ["day", "week", "month", "year", "category", "kind"],
        }),
        queryParameter(
          "splitBy",
          false,
          { type: "string", enum: ["category", "kind"] },
          "Only with a time grouping"
        ),
        queryParameter("kind", false, {
          type: "string",
          enum: ["DEPENSE", "ENTREE"],
        }),
      ],
      responses: {
        "200": {
          description: "Grouped income, expense, net and count",
          content: { "application/json": { schema: analyticsResponseSchema } },
        },
        "401": { description: "Missing or invalid access token" },
        "422": {
          description:
            "Invalid parameters, inverted range (code ANALYTICS_QUERY_INVALID) or range too large (code ANALYTICS_RANGE_TOO_LARGE)",
        },
      },
    },
  },
};
