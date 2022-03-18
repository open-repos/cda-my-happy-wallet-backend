import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from "./../config/config";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const tokenJwtTAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // console.log(req.cookies)
  const authHeader = req.headers.authorization;
  // console.log("authtoken check", token)
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    // try {
    jwt.verify(token, ACCESS_TOKEN_SECRET as string,function(err:any, _:any) {
        if (err) {
            refreshTokenAuth(req,res,next)
        } else {
        }
      });
      next();
    } else {
        refreshTokenAuth(req,res,next)
    } 

    }



export const refreshTokenAuth = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // console.log(req.cookies)
    const token = req.cookies.refresh_token ;
    console.log("refresh token call function", token)
    // console.log("authtoken check", token)
    if (token == null) {
      return res.status(403).send({
        error: true,
        message: "No refresh-token provided. ",
      });
    } else {
      try {
        const user = jwt.verify(token, REFRESH_TOKEN_SECRET  as string);
        req.user = user;
        console.log("req.user", req.user);
        next();
      } catch (err) {
        // console.log(err);
        res.clearCookie("refresh_token");
        return res.status(401).send({
          error: true,
          message: "Invalid credentials refreshtoken . Unauthorized access.",
          expiredAt:err.expiredAt
        });
      }
      return;
    }

  };
