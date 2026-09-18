import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import {
  MonthlyEventController,
  monthlyEventController,
  toMonthlyEventHttpError,
  validateMonthlyEventBody,
} from "../modules/monthlyEvents";
import {
  paginatedCollectionResponse,
  paginationParameters,
} from "../utils/paginationSwagger";

type Action = (req: Request, res: Response) => Promise<Response>;
const handle =
  (action: Action): RequestHandler =>
  (req, res, next: NextFunction) =>
    Promise.resolve(action(req, res)).catch((error) =>
      next(toMonthlyEventHttpError(error))
    );

export const createMonthlyEventRouter = (
  controller: MonthlyEventController,
  authenticate: RequestHandler = tokenJwtTAuth
): Router => {
  const router = Router();
  router.get(
    "/event-occurrences",
    authenticate,
    handle((req, res) => controller.occurrences(req, res))
  );
  router.get(
    "/events",
    authenticate,
    handle((req, res) => controller.list(req, res))
  );
  router.post(
    "/events",
    authenticate,
    validateMonthlyEventBody,
    handle((req, res) => controller.create(req, res))
  );
  router.get(
    "/events/:id",
    authenticate,
    handle((req, res) => controller.get(req, res))
  );
  router.put(
    "/events/:id",
    authenticate,
    validateMonthlyEventBody,
    handle((req, res) => controller.update(req, res))
  );
  router.delete(
    "/events/:id",
    authenticate,
    handle((req, res) => controller.delete(req, res))
  );
  return router;
};

export const monthlyEventRouter = createMonthlyEventRouter(
  monthlyEventController
);

const securedResponses = {
  "400": { description: "Invalid resource identifier" },
  "401": { description: "Missing or invalid access token" },
  "404": { description: "Event not found for the authenticated user" },
  "422": { description: "Request or pagination validation failed" },
};
const requestBody = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/MonthlyEventInput" },
    },
  },
};
const idParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};

export const swMonthlyEventRouter = {
  "/events": {
    get: {
      tags: ["Evenements"],
      summary: "List personal monthly-event rules",
      security: [{ accessToken_auth: [] }],
      parameters: paginationParameters,
      responses: {
        "200": paginatedCollectionResponse("Paginated event rules"),
        ...securedResponses,
      },
    },
    post: {
      tags: ["Evenements"],
      summary: "Create a monthly-event rule",
      security: [{ accessToken_auth: [] }],
      requestBody,
      responses: {
        "201": { description: "Event created" },
        ...securedResponses,
      },
    },
  },
  "/events/{id}": {
    parameters: [idParameter],
    get: {
      tags: ["Evenements"],
      summary: "Read an event rule",
      security: [{ accessToken_auth: [] }],
      responses: { "200": { description: "Event found" }, ...securedResponses },
    },
    put: {
      tags: ["Evenements"],
      summary: "Replace an event rule",
      security: [{ accessToken_auth: [] }],
      requestBody,
      responses: {
        "200": { description: "Event updated" },
        ...securedResponses,
      },
    },
    delete: {
      tags: ["Evenements"],
      summary: "Delete an event rule",
      security: [{ accessToken_auth: [] }],
      responses: {
        "204": { description: "Event deleted" },
        ...securedResponses,
      },
    },
  },
  "/event-occurrences": {
    get: {
      tags: ["Evenements"],
      summary: "List calculated event occurrences for a calendar month",
      security: [{ accessToken_auth: [] }],
      parameters: [
        {
          name: "month",
          in: "query",
          required: true,
          schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        },
        ...paginationParameters,
      ],
      responses: {
        "200": paginatedCollectionResponse("Paginated event occurrences"),
        ...securedResponses,
      },
    },
  },
};
