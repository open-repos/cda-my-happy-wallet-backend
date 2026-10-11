import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import {
  EventOccurrenceController,
  eventOccurrenceController,
  toEventOccurrenceHttpError,
  validateRealizeBody,
} from "../modules/eventOccurrences";
import {
  paginatedCollectionResponse,
  paginationParameters,
} from "../utils/paginationSwagger";

type Action = (req: Request, res: Response) => Promise<Response>;
const handle =
  (action: Action): RequestHandler =>
  (req, res, next: NextFunction) =>
    Promise.resolve(action(req, res)).catch((error) =>
      next(toEventOccurrenceHttpError(error))
    );

export const createEventOccurrenceRouter = (
  controller: EventOccurrenceController,
  authenticate: RequestHandler = tokenJwtTAuth
): Router => {
  const router = Router();
  router.get(
    "/event-occurrences/pending",
    authenticate,
    handle((req, res) => controller.pending(req, res))
  );
  router.post(
    "/event-occurrences/:eventId/:date/realize",
    authenticate,
    validateRealizeBody,
    handle((req, res) => controller.realize(req, res))
  );
  router.post(
    "/event-occurrences/:eventId/:date/cancel",
    authenticate,
    handle((req, res) => controller.cancel(req, res))
  );
  return router;
};

export const eventOccurrenceRouter = createEventOccurrenceRouter(
  eventOccurrenceController
);

const occurrenceParameters = [
  {
    name: "eventId",
    in: "path",
    required: true,
    schema: { type: "integer", minimum: 1 },
  },
  {
    name: "date",
    in: "path",
    required: true,
    schema: { type: "string", format: "date" },
  },
];
const commandResponses = {
  "200": { description: "Identical command already succeeded (replay)" },
  "201": { description: "Decision recorded" },
  "400": { description: "Invalid event identifier" },
  "401": { description: "Missing or invalid access token" },
  "404": { description: "Event, occurrence or category not found" },
  "409": {
    description:
      "OCCURRENCE_ALREADY_RESOLVED or PERIOD_CLOSED business conflict",
  },
  "422": { description: "Request validation failed" },
};

export const swEventOccurrenceRouter = {
  "/event-occurrences/pending": {
    get: {
      tags: ["Evenements"],
      summary:
        "Planned occurrences without decision, over the 12 months ending at `through`",
      security: [{ accessToken_auth: [] }],
      parameters: [
        {
          name: "through",
          in: "query",
          description: "Inclusive last civil date, today by default",
          schema: { type: "string", format: "date" },
        },
        ...paginationParameters,
      ],
      responses: {
        "200": paginatedCollectionResponse("Paginated pending occurrences"),
        "401": { description: "Missing or invalid access token" },
        "422": { description: "Invalid date or pagination" },
      },
    },
  },
  "/event-occurrences/{eventId}/{date}/realize": {
    parameters: occurrenceParameters,
    post: {
      tags: ["Evenements"],
      summary: "Turn an occurrence into a one-off operation in one transaction",
      security: [{ accessToken_auth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["categoryId"],
              additionalProperties: false,
              properties: {
                categoryId: { type: "integer", minimum: 1 },
                title: { type: "string", minLength: 2, maxLength: 50 },
                amount: { type: "string", example: "47.80" },
                operationDate: { type: "string", format: "date" },
              },
            },
          },
        },
      },
      responses: commandResponses,
    },
  },
  "/event-occurrences/{eventId}/{date}/cancel": {
    parameters: occurrenceParameters,
    post: {
      tags: ["Evenements"],
      summary: "Cancel an occurrence without touching real balances",
      security: [{ accessToken_auth: [] }],
      responses: commandResponses,
    },
  },
};
