import { Result, ResultCode } from "./../../utils/results/";
import { ErrorException, ErrorCode } from "./../../utils/errors";
import { prisma } from "../../database/index";
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  NODE_ENV,
} from "../../config/config";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { UserRepo } from "../user/userRepo";

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

  console.log("body", req.body);
  console.log("cookies", req.cookies);
  if (email == null) {
    return next(
      new ErrorException(
        ErrorCode.IncompleteRequestBody,
        "Email parameter is missing"
      )
    );
  }

  if (cookies.id_user == null) {
    return next(
      new ErrorException(ErrorCode.IncompleteRequestCookie, "Cookie is empty")
    );
  }
  const userEmail = await userRepo.getUserByEmail(email);
  const user = await userRepo.getUserById(parseInt(cookies.id_user));
  console.log("user", user);
  console.log("userEmail!", userEmail!);
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
    userEmail.id !== parseInt(cookies.id_user)
  ) {
    return next(new ErrorException(ErrorCode.Unauthorized, "Invalid User"));
  }

  jwt.verify(
    cookies.refresh_token,
    REFRESH_TOKEN_SECRET as string,
    (err: any, _: any) => {
      if (err) {
        res.clearCookie("refresh_token");
        res.clearCookie("id_user");
        return next(
          new ErrorException(
            ErrorCode.Unauthorized,
            "Invalid credentials refreshtoken .  RefreshToken no more valid."
          )
        );
        // return res.status(403).send({
        //   error: true,
        //   message: "Invalid Credentials - RefreshToken no more valid",
        // });
      }

      const expireIn = "5min";
      const accessToken = jwt.sign(
        { id: user.id },
        ACCESS_TOKEN_SECRET as string,
        {
          expiresIn: expireIn,
        }
      );

      let data;
      const { id, password, ...userWithoutPasswordAndId } = user;
      console.log(
        "user controller without id and password",
        userWithoutPasswordAndId
      );
      data = userWithoutPasswordAndId;

      const refreshToken = jwt.sign(
        { id: user.id },
        REFRESH_TOKEN_SECRET as string,
        { expiresIn: "20min" }
      );

      res.cookie("id_user", user.id, {
        httpOnly: true,
        secure: true,
        maxAge: 900000, //15min
      });
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        maxAge: 900000, //15min
      });
      return res.status(200).json({
        success: true,
        user: data,
        accessToken: accessToken,
        expires: expireIn,
      });
    }
  );
  return;
  // }
  //     return
};
