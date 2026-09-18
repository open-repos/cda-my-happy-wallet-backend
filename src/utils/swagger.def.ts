import { swRenewTokenRouter, swAdminRouter } from './../router';
import { ErrorCode } from "./errors/errorCode.error";
import { ErrorException } from "./errors/errorException.error";
import { ResSchemaSwg } from "./results/index";
import { errorSchemaSwg } from "./errors/index";
import { SchemaSwg } from "./validators/index";
import { APP_BASE_URL } from "../config/config";
import { swUserRouter } from "../routes/user";
import { swOperationFixeRouter } from '../routes/operationsFixes';
import { swNativeSessionRouter } from '../routes/nativeSession';
import { swOneOffOperationRouter } from '../routes/oneOffOperations';
import { swMonthlyEventRouter } from '../routes/monthlyEvents';

const swagger = {
  openapi: "3.0.0",
  info: {
    title: "MyHappyWallet API",
    version: "1.0.0",
    description: "The REST API MyHappyWallet",
  },
  basePath: APP_BASE_URL,
  servers: [
    {
      url: `http://localhost:4200${APP_BASE_URL}`,
      description: "Development server",
    },
    {
      url: `https://api.myhappywallet.andriacapai.com${APP_BASE_URL}`,
      description: "Production server",
    },
  ],
  tags: [
    {
      name: "Users",
      description:
        "Everything about Users (login, register, resetPassword and so on)",
    },
    {
      name: "OperationsFixe",
      description:
        "Everything about Operation Fixe (incomes, charges each month)",
    },
    {
      name: "Operations",
      description: "All Request about Operations (expenses, incomes)",
    },
    {
      name: "ResteAVivre",
      description: "All Request about ResteAVivre (disposable income)",
    },
    {
      name: "Evenements",
      description:
        "All Request about Evenements (Future Events scheduled in order to budget)",
    },
    {
      name: "Objectifs",
      description:
        "All Request about Objectifs (Goals targeted and budget to reach it)",
    },
    {
      name: "ResteAVivreFictif",
      description:
        "All Request about ResteAVivreFictif (fictive disposable income according to events and goals)",
    },
  ],
  paths: {
    ...swAdminRouter,
    ...swUserRouter,
    ...swRenewTokenRouter,
    ...swNativeSessionRouter,
    ...swOperationFixeRouter,
    ...swOneOffOperationRouter,
    ...swMonthlyEventRouter
  },
  components: {
    parameters: {
      PaginationLimit: {
        name: "limit",
        in: "query",
        required: false,
        description: "Number of collection items to return (default 50, maximum 100)",
        schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      PaginationCursor: {
        name: "cursor",
        in: "query",
        required: false,
        description: "Opaque cursor returned by the previous page",
        schema: { type: "string", maxLength: 2048 },
      },
    },
    schemas: {
      PaginationMeta: {
        type: "object",
        required: ["limit", "hasNext", "nextCursor"],
        additionalProperties: false,
        properties: {
          limit: { type: "integer", minimum: 1, maximum: 100 },
          hasNext: { type: "boolean" },
          nextCursor: { type: "string", nullable: true },
        },
      },
      Register: SchemaSwg.register,
      Login: SchemaSwg.login,
      Email: SchemaSwg.email,
      ResetPassword: SchemaSwg.email,
      NewPassword: SchemaSwg.newpassword,
      ErrorResponse: errorSchemaSwg,
      SuccessResponse: ResSchemaSwg.success,
      AuthResponse: ResSchemaSwg.resAuth,
      RenewAccessToken: SchemaSwg.renewAccessToken,
      ListeOperationFixeResponse:ResSchemaSwg.arrayOperationFixe,
      ListeChargeResponse:ResSchemaSwg.arrayCharge,
      ListeRevenuResponse:ResSchemaSwg.arrayRevenu,
      Charge:SchemaSwg.charge,
      Revenu:SchemaSwg.revenu,
      DeleteEmailAccount:SchemaSwg.deleteEmail,
      NativeRefreshSession:SchemaSwg.nativeRefreshSession,
      OperationCategoryInput: {
        type: "object",
        required: ["name"],
        additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 50 },
          color: {
            type: "string",
            nullable: true,
            pattern: "^#[0-9A-Fa-f]{6}$",
          },
        },
      },
      OneOffOperationInput: {
        type: "object",
        required: [
          "title",
          "amount",
          "currency",
          "kind",
          "operationDate",
          "categoryId",
        ],
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 2, maxLength: 50 },
          amount: {
            oneOf: [
              { type: "number", minimum: 0.01, maximum: 99999999.99 },
              { type: "string", pattern: "^(0|[1-9]\\d{0,7})(?:\\.\\d{1,2})?$" },
            ],
          },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          kind: { type: "string", enum: ["DEPENSE", "ENTREE"] },
          operationDate: { type: "string", format: "date" },
          categoryId: { type: "integer", minimum: 1 },
        },
      },
      MonthlyEventInput: {
        type: "object",
        required: ["title", "amount", "currency", "kind", "startDate", "recurrence"],
        additionalProperties: false,
        properties: {
          title: { type: "string", minLength: 2, maxLength: 50 },
          amount: { oneOf: [{ type: "number", minimum: 0.01, maximum: 99999999.99 }, { type: "string", pattern: "^(0|[1-9]\\d{0,7})(?:\\.\\d{1,2})?$" }] },
          currency: { type: "string", minLength: 3, maxLength: 3 },
          kind: { type: "string", enum: ["DEPENSE", "ENTREE"] },
          startDate: { type: "string", format: "date" },
          recurrence: { type: "string", enum: ["AUCUNE", "MENSUELLE"] },
          endDate: { type: "string", format: "date", nullable: true },
        },
      }
    },
    responses: {
      UnauthorizedError401: {
        description: new ErrorException(
          ErrorCode.Unauthorized,
          "Access token is missing or invalid"
        ).message,
      },
    },
    securitySchemes: {
      resetPsswdToken: {
        type: "apiKey",
        in: "cookie",
        name: "reset_token_password",
      },
      accessToken_auth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      refreshToken: {
        type: "apiKey",
        in: "cookie",
        name: "refresh_token",
      },
      userId: {
        type: "apiKey",
        in: "cookie",
        name: "id_user",
      },
    },
  },
};
export default swagger;
