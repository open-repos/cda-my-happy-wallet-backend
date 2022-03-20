import { ErrorCode } from './../utils/errors/errorCode.error';
import { ErrorException} from './../utils/errors/errorException.error';
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,NODE_ENV } from "../config/config";
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const tokenJwtTAuth = (
  req: Request,
  _: Response,
  next: NextFunction
) => {
  if (NODE_ENV==="development"){
    console.log("MODE development : SKip middleware")
    return next()
  }
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, ACCESS_TOKEN_SECRET as string,function(err:any, _:any) {
        if (err) {
          console.log("WRONG TOKEN")
          req.shoulRunMiddleware2=false;
          next(new ErrorException(ErrorCode.Unauthorized,"The access token is not valid."))
          // return refreshTokenAuth(req,res,next)
        } 
        req.shoulRunMiddleware2=false;
       return;
      });
      req.shoulRunMiddleware2=false;
      return;
    } else {
        next(new ErrorException(ErrorCode.AccessForbidden,"Access Forbidden . Header is Missing"))
    } 
    next(new ErrorException(ErrorCode.AccessForbidden,"Access Forbidden . Error about accessToken"))
    }



export const refreshTokenAuth =  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if(!req.shoulRunMiddleware2){
      console.log("skipped middleware 2")
      return;
    };
    const token = req.cookies.refresh_token ;
    // console.log("refresh token call function", token)
    if (token == null) {
      return next(new ErrorException(ErrorCode.AccessForbidden,"No refresh-token provided."))
    } else {
      try {
        const user =  jwt.verify(token, REFRESH_TOKEN_SECRET  as string);
        req.user = user;
        console.log("req.user", req.user);
        return
      } catch (err) {
        res.clearCookie("refresh_token");
        next(new ErrorException(ErrorCode.Unauthenticated,"Invalid credentials refreshtoken . Unauthorized access."))
      }
    }

  };
