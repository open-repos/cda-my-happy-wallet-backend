import { prisma } from "../../database/index";
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from "../../config/config";
import jwt from "jsonwebtoken";
import { Request, Response } from "express";
import { UserRepo } from "../user/userRepo";

export const renewAccessToken = async (req: Request, res: Response) => {
  const { email, token } = req.body;
  const cookies = req.cookies;
  const userRepo = new UserRepo(prisma);

  console.log(req.body);
  console.log(req.cookies);
  if (!email) {
    return res.status(401).send({
      error: true,
      message: "No email provided in body. ",
    });
  }

  const user = await userRepo.getUserByEmail(req.body.email);
  if (!user) {
    return res.status(403).send({
      error: true,
      message: "Email or password mismatch",
    });
  }

  if (!token) {
    return res.status(401).send({
      error: true,
      message: "No token provided in body. ",
    });
  }

  if (!cookies) {
    return res.status(401).send({
      error: true,
      message: "Cookie empty",
    });
  }

  // if (!cookies.refresh_token){
  jwt.verify(
    cookies.refresh_token,
    REFRESH_TOKEN_SECRET,
    (err: any, _: any) => {
      if (err) {
        res.clearCookie("refresh_token");
        return res.status(403).send({
          error: true,
          message: "Invalid Credentials - RefreshToken no more valid",
        });
      }

      const accessToken = jwt.sign({ id: user.id }, ACCESS_TOKEN_SECRET, {
        expiresIn: "5m",
      });

      let data;
      const { id, password, ...userWithoutPasswordAndId } = user;
      console.log(
        "user controller without id and password",
        userWithoutPasswordAndId
      );
      data = userWithoutPasswordAndId;

      return res.status(200).send({
        success: true,
        user: data,
        accessToken: accessToken,
      });
    }
  );
  return;
  // }
  //     return
};
