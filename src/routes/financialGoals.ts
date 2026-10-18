import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import {
  FinancialGoalController,
  financialGoalController,
  toFinancialGoalHttpError,
  validateFinancialGoalBody,
} from "../modules/financialGoals";
import {
  paginatedCollectionResponse,
  paginationParameters,
} from "../utils/paginationSwagger";

type Action = (req: Request, res: Response) => Promise<Response>;
const handle =
  (action: Action): RequestHandler =>
  (req, res, next: NextFunction) =>
    Promise.resolve(action(req, res)).catch((error) =>
      next(toFinancialGoalHttpError(error))
    );

export const createFinancialGoalRouter = (
  controller: FinancialGoalController,
  authenticate: RequestHandler = tokenJwtTAuth
): Router => {
  const router = Router();
  router.get(
    "/goals",
    authenticate,
    handle((req, res) => controller.list(req, res))
  );
  router.post(
    "/goals",
    authenticate,
    validateFinancialGoalBody,
    handle((req, res) => controller.create(req, res))
  );
  router.get(
    "/goals/:id",
    authenticate,
    handle((req, res) => controller.get(req, res))
  );
  router.put(
    "/goals/:id",
    authenticate,
    validateFinancialGoalBody,
    handle((req, res) => controller.update(req, res))
  );
  router.delete(
    "/goals/:id",
    authenticate,
    handle((req, res) => controller.delete(req, res))
  );
  return router;
};

export const financialGoalRouter = createFinancialGoalRouter(
  financialGoalController
);

const securedResponses = {
  "400": { description: "Invalid resource identifier" },
  "401": { description: "Missing or invalid access token" },
  "404": { description: "Goal not found for the authenticated user" },
  "422": { description: "Request or pagination validation failed" },
};
const goalResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: { data: { $ref: "#/components/schemas/FinancialGoal" } },
      },
    },
  },
});
const requestBody = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/FinancialGoalInput" },
    },
  },
};
const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};

export const swFinancialGoalRouter = {
  "/goals": {
    get: {
      tags: ["Objectifs"],
      summary: "List personal financial goals with their forecast",
      security: [{ accessToken_auth: [] }],
      parameters: paginationParameters,
      responses: {
        "200": paginatedCollectionResponse("Paginated financial goals"),
        ...securedResponses,
      },
    },
    post: {
      tags: ["Objectifs"],
      summary: "Create a financial goal",
      security: [{ accessToken_auth: [] }],
      requestBody,
      responses: {
        "201": goalResponse("Goal created"),
        ...securedResponses,
      },
    },
  },
  "/goals/{id}": {
    parameters: [idParameter],
    get: {
      tags: ["Objectifs"],
      summary: "Read a financial goal and its forecast",
      security: [{ accessToken_auth: [] }],
      responses: { "200": goalResponse("Goal found"), ...securedResponses },
    },
    put: {
      tags: ["Objectifs"],
      summary: "Replace a financial goal",
      security: [{ accessToken_auth: [] }],
      requestBody,
      responses: {
        "200": goalResponse("Goal updated"),
        ...securedResponses,
      },
    },
    delete: {
      tags: ["Objectifs"],
      summary: "Delete a financial goal",
      security: [{ accessToken_auth: [] }],
      responses: {
        "204": { description: "Goal deleted" },
        ...securedResponses,
      },
    },
  },
};
