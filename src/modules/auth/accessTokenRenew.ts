import { ErrorException,ErrorCode } from "./../../utils/errors";
import { prisma } from "../../database/index";
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  NODE_ENV,
} from "../../config/config";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { UserRepo } from "../user/userRepo";

export const renewAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.body;
  const cookies = req.cookies;
  const userRepo = new UserRepo(prisma);

  console.log(req.body);
  console.log(req.cookies);
  if (!email) {
    // return res.status(401).send({
    //   error: true,
    //   message: "No email provided in body. ",
    // });
    return next(
      new ErrorException(
        ErrorCode.IncompleteRequestBody,
        "Email parameter is missing"
      )
    );
  }


  if (!cookies) {
    // return res.status(401).send({
    //   error: true,
    //   message: "Cookie empty",
    // });
    return next(
      new ErrorException(ErrorCode.IncompleteRequestCookie, "Cookie is empty")
    );
  }
  const userEmail = await userRepo.getUserByEmail(email);
  const user = await userRepo.getUserById(parseInt(cookies.id_user));
  console.log("user",user)
  if (!user || userEmail.email !== user.email || userEmail.id !== parseInt(cookies.id_user) ) {
    // return res.status(403).send({
    //   error: true,
    //   message: "Email or password mismatch",
    // });
    return next(new ErrorException(ErrorCode.Unauthorized,"Invalid User"));
  }

  // if (!token) {
  //   return next(new ErrorException(ErrorCode.AccessForbidden,'Token is missing in request body'))
  // }

  // if (!cookies.refresh_token){
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
        secure: NODE_ENV === "production",
        maxAge: 900000, //15min
      });
      res.cookie("refresh_token", refreshToken, {
        httpOnly: true,
        secure: NODE_ENV === "production",
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
