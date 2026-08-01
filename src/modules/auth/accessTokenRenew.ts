import { Result, ResultCode } from "./../../utils/results/";
import { ErrorException, ErrorCode } from "./../../utils/errors";
import { Request, Response, NextFunction } from "express";
import { authCookieOptions, clearAuthCookie } from "./authCookieOptions";
import { refreshSessionService } from "./refreshSession";
import { renewSession } from "./renewSession";

export { refreshSessionService };

export const swRenewAccessToken = {
  tags: ["Users"],
  summary: "Renew access token",
  operationId: "renewAccessToken",
  requestBody: {
    description: "Give email and grant_type to get new access token",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/RenewAccessToken",
        },
      },
    },
    required: true,
  },
  responses: {
    "200": {
      description: new Result(ResultCode.Created, "", "Successfully logged in")
        .message,
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/AuthResponse",
          },
        },
      },
      headers: {
        "Set-Cookie": {
          schema: {
            type: "string",
            example: {
              refresh_token: "abcde12345",
              Path: "/",
              HttpOnly: true,
            },
          },
        },
        "\0Set-Cookie": {
          schema: {
            type: "string",
            example: {
              id_user: "1",
              Path: "/",
              HttpOnly: true,
            },
          },
        },
      },
    },
    "400": {
      description: new ErrorException(ErrorCode.IncompleteRequestBody).message,
    },
    "401": {
      $ref: "#/components/responses/UnauthorizedError401",
    },
    "403": {
      description: new ErrorException(ErrorCode.Unauthorized).message,
    },
    "404": {
      description: new ErrorException(ErrorCode.NotFound).message,
    },
    "405": {
      description: new ErrorException(ErrorCode.InvalidInput).message,
    },
  },
  security: [
    {
      accessToken_auth: [],
    },
    {
      userId: [],
      refreshToken: [],
    },
  ],
};

export const renewAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.body;
  const cookies = req.cookies;
  if (email == null) {
    return next(
      new ErrorException(
        ErrorCode.IncompleteRequestBody,
        "Email parameter is missing"
      )
    );
  }

  const refreshToken = cookies.refresh_token;
  if (refreshToken == null) {
    return next(new ErrorException(ErrorCode.Unauthorized, "Cookie is empty"));
  }

  try {
    const result = await renewSession.execute(refreshToken, email);
    res.cookie("id_user", result.userId, authCookieOptions(900000));
    res.cookie("refresh_token", result.refreshToken, authCookieOptions(900000));
    return res.status(200).json({
      success: true,
      payload: {
        user: result.user,
        accessToken: result.accessToken,
        expires: result.accessTokenExpires,
      },
    });
  } catch (error) {
    clearAuthCookie(res, "refresh_token");
    clearAuthCookie(res, "id_user");
    return next(error);
  }
};
