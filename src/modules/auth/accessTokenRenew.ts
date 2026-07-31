import { Result, ResultCode } from "./../../utils/results/";
import { ErrorException, ErrorCode } from "./../../utils/errors";
import { prisma } from "../../database/index";
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
}
 from "../../config/config";
import { Request, Response, NextFunction } from "express";
import { UserRepo } from "../user/userRepo";
import { JsonWebTokenService } from "./token/JsonWebTokenService";
import { getAuthTokenPayload } from "./token/AuthTokenPayload";
import { authCookieOptions, clearAuthCookie } from "./authCookieOptions";

const tokenService = new JsonWebTokenService();

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
  const userRepo = new UserRepo(prisma);

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

  let tokenUser;
  try {
    const decodedToken = tokenService.verify(
      refreshToken,
      REFRESH_TOKEN_SECRET as string
    );
    tokenUser = getAuthTokenPayload(decodedToken);
  } catch {
    tokenUser = null;
  }

  if (tokenUser == null) {
    clearAuthCookie(res, "refresh_token");
    clearAuthCookie(res, "id_user");
    return next(
      new ErrorException(
        ErrorCode.Unauthorized,
        "Invalid credentials refreshtoken .  RefreshToken no more valid."
      )
    );
  }

  const userEmail = await userRepo.getUserByEmail(email);
  const user = await userRepo.getUserById(tokenUser.id);
  if (userEmail == null) {
    return next(
      new ErrorException(ErrorCode.EmailNotFound, "Email user not found")
    );
  }
  if (user == null) {
    return next(new ErrorException(ErrorCode.Unauthorized));
  }
  if (
    userEmail.email !== user.email ||
    userEmail.id !== tokenUser.id
  ) {
    return next(new ErrorException(ErrorCode.Unauthorized, "Invalid User"));
  }

  const expireIn = "5min";
  const accessToken = tokenService.sign(
    { id: user.id },
    ACCESS_TOKEN_SECRET as string,
    {
      expiresIn: expireIn,
    }
  );

  let data;
  const { id, password, ...userWithoutPasswordAndId } = user;
  data = userWithoutPasswordAndId;

  const renewedRefreshToken = tokenService.sign(
    { id: user.id },
    REFRESH_TOKEN_SECRET as string,
    { expiresIn: "20min" }
  );

  res.cookie("id_user", user.id, authCookieOptions(900000));
  res.cookie("refresh_token", renewedRefreshToken, authCookieOptions(900000));
  return res.status(200).json({
    success: true,
    payload: {user:data,
    accessToken: accessToken,
    expires: expireIn}
  });
};
