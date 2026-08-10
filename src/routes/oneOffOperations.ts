import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import {
  OneOffOperationController,
  oneOffOperationController,
  toOperationHttpError,
  validateCategoryBody,
  validateOperationBody,
} from "../modules/operations";

type ControllerAction = (req: Request, res: Response) => Promise<Response>;

const handle = (action: ControllerAction): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(action(req, res)).catch((error) =>
      next(toOperationHttpError(error))
    );

export const createOneOffOperationRouter = (
  controller: OneOffOperationController,
  authenticate: RequestHandler = tokenJwtTAuth
): Router => {
  const router = Router();

  router.get(
    "/operation-categories",
    authenticate,
    handle((req, res) => controller.listCategories(req, res))
  );
  router.post(
    "/operation-categories",
    authenticate,
    validateCategoryBody,
    handle((req, res) => controller.createCategory(req, res))
  );
  router.put(
    "/operation-categories/:id",
    authenticate,
    validateCategoryBody,
    handle((req, res) => controller.updateCategory(req, res))
  );
  router.delete(
    "/operation-categories/:id",
    authenticate,
    handle((req, res) => controller.deleteCategory(req, res))
  );

  router.get(
    "/operations",
    authenticate,
    handle((req, res) => controller.listOperations(req, res))
  );
  router.post(
    "/operations",
    authenticate,
    validateOperationBody,
    handle((req, res) => controller.createOperation(req, res))
  );
  router.get(
    "/operations/:id",
    authenticate,
    handle((req, res) => controller.getOperation(req, res))
  );
  router.put(
    "/operations/:id",
    authenticate,
    validateOperationBody,
    handle((req, res) => controller.updateOperation(req, res))
  );
  router.delete(
    "/operations/:id",
    authenticate,
    handle((req, res) => controller.deleteOperation(req, res))
  );

  return router;
};

export const oneOffOperationRouter = createOneOffOperationRouter(
  oneOffOperationController
);

const securedResponses = {
  "400": { description: "Invalid resource identifier" },
  "401": { description: "Missing or invalid access token" },
  "404": { description: "Resource not found for the authenticated user" },
  "409": { description: "Duplicate or referenced category conflict" },
  "422": { description: "Request validation failed" },
};

const categoryRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/OperationCategoryInput" },
    },
  },
};

const operationRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/OneOffOperationInput" },
    },
  },
};

const resourceIdParameter = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "integer", minimum: 1 },
};

export const swOneOffOperationRouter = {
  "/operation-categories": {
    get: {
      tags: ["Operations"],
      summary: "List personal operation categories",
      security: [{ accessToken_auth: [] }],
      responses: { "200": { description: "Category collection" }, ...securedResponses },
    },
    post: {
      tags: ["Operations"],
      summary: "Create a personal operation category",
      security: [{ accessToken_auth: [] }],
      requestBody: categoryRequestBody,
      responses: { "201": { description: "Category created" }, ...securedResponses },
    },
  },
  "/operation-categories/{id}": {
    parameters: [resourceIdParameter],
    put: {
      tags: ["Operations"],
      summary: "Replace a personal operation category",
      security: [{ accessToken_auth: [] }],
      requestBody: categoryRequestBody,
      responses: { "200": { description: "Category updated" }, ...securedResponses },
    },
    delete: {
      tags: ["Operations"],
      summary: "Delete an unused personal operation category",
      security: [{ accessToken_auth: [] }],
      responses: { "204": { description: "Category deleted" }, ...securedResponses },
    },
  },
  "/operations": {
    get: {
      tags: ["Operations"],
      summary: "List personal one-off operations",
      security: [{ accessToken_auth: [] }],
      responses: { "200": { description: "Operation collection" }, ...securedResponses },
    },
    post: {
      tags: ["Operations"],
      summary: "Create a personal one-off operation",
      security: [{ accessToken_auth: [] }],
      requestBody: operationRequestBody,
      responses: { "201": { description: "Operation created" }, ...securedResponses },
    },
  },
  "/operations/{id}": {
    parameters: [resourceIdParameter],
    get: {
      tags: ["Operations"],
      summary: "Read a personal one-off operation",
      security: [{ accessToken_auth: [] }],
      responses: { "200": { description: "Operation found" }, ...securedResponses },
    },
    put: {
      tags: ["Operations"],
      summary: "Replace a personal one-off operation",
      security: [{ accessToken_auth: [] }],
      requestBody: operationRequestBody,
      responses: { "200": { description: "Operation updated" }, ...securedResponses },
    },
    delete: {
      tags: ["Operations"],
      summary: "Delete a personal one-off operation",
      security: [{ accessToken_auth: [] }],
      responses: { "204": { description: "Operation deleted" }, ...securedResponses },
    },
  },
};
