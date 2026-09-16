import { NextFunction, Request, Response } from "express";
import { FRONTEND_URL } from "../../../../config/config";
import { ErrorCode, ErrorException } from "../../../../utils/errors";
import { Result, ResultCode } from "../../../../utils/results";
import { ConfirmRegistrationUser } from "./confirmRegistrationUser";

const HTML_MEDIA_TYPE = "text/html";

function explicitlyAcceptsHtml(req: Request): boolean {
  const acceptHeader = req.get("accept") ?? "";
  return acceptHeader
    .split(",")
    .map((mediaRange) => mediaRange.split(";", 1)[0].trim().toLowerCase())
    .includes(HTML_MEDIA_TYPE);
}

function confirmationErrorCode(error: ErrorException): string | null {
  if (error.name === ErrorCode.Conflict) {
    return "already-used";
  }
  if (error.name === ErrorCode.Unauthorized) {
    return "invalid-or-expired";
  }
  return null;
}

function loginRedirect(parameters: Record<string, string>): string {
  const url = new URL("/login", FRONTEND_URL);
  Object.entries(parameters).forEach(([name, value]) => {
    url.searchParams.set(name, value);
  });
  return url.toString();
}

export const swConfirmRegistrationUser = {
  summary: "Check valid email account",
  description: "Confirm Registration by clicking on link received by email",
  operationId: "verifyUserByUserIDandToken",
  tags: ["Users"],
  parameters: [
    {
      name: "userId",
      in: "path",
      description: "ID of user registered",
      required: true,
      schema: {
        type: "integer",
        format: "int64",
      },
    },
    {
      name: "token",
      in: "path",
      description: "Token inside email to confirm registration account user",
      required: true,
      schema: {
        type: "string",
      },
    },
  ],
  responses: {
    "201": {
      description: new Result(
        ResultCode.Created,
        "",
        "User successfully registered"
      ).message,
    },
    "401": {
      description: new ErrorException(ErrorCode.Unauthorized).message,
    },
    "409": {
      description: new ErrorException(ErrorCode.Conflict).message,
    },
    "404": {
      description: new ErrorException(ErrorCode.NotFound).message,
    },
  },
};

export class ConfirmRegistrationUserController {
  constructor(private readonly useCase: ConfirmRegistrationUser) {}

  public async execute(req: Request, res: Response, _: NextFunction) {
    try {
      const result = await this.useCase.execute(req.params.id, req.params.token);
      if (!result) {
        throw new ErrorException(ErrorCode.UnknownError);
      }

      return res
        .status(201)
        .redirect(loginRedirect({ success: "true", message: "registrationok" }));
    } catch (error) {
      if (explicitlyAcceptsHtml(req) && error instanceof ErrorException) {
        const code = confirmationErrorCode(error);
        if (code !== null) {
          return res.redirect(303, loginRedirect({ confirmation: code }));
        }
      }
      throw error;
    }
  }
}
