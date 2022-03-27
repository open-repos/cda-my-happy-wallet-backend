import { swRenewTokenRouter, swAdminRouter } from './../router';
import { ErrorCode } from "./errors/errorCode.error";
import { ErrorException } from "./errors/errorException.error";
import { ResSchemaSwg } from "./results/index";
import { errorSchemaSwg } from "./errors/index";
import { SchemaSwg } from "./validators/index";
import { PORT, APP_BASE_URL } from "../config/config";
import { swUserRouter } from "../routes/user";
import { swOperationFixeRouter } from '../routes/operationsFixes';

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
      url: `http://localhost:${PORT}${APP_BASE_URL}`,
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
    ...swOperationFixeRouter
  },
  components: {
    schemas: {
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
      Revenu:SchemaSwg.revenu
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



