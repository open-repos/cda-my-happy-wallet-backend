
import { ErrorException,ErrorCode } from './../utils/errors/';
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET} from "../config/config";
import { Request, Response, NextFunction } from "express";
import { JsonWebTokenService } from "../modules/auth/token/JsonWebTokenService";

const tokenService = new JsonWebTokenService();

export const tokenJwtTAuth = (
  req: Request,
  _: Response,
  next: NextFunction
) => {
  // if (NODE_ENV==="development"){
  //   console.log("MODE development : SKip middleware")
  //   return next()
  // }
  console.log("INSIDE MIDDLEWARE")
  const authHeader = req.headers.authorization;
  console.log("authHeader",authHeader)
  if (authHeader!=null) {
    const token = authHeader.split(' ')[1];
    console.log("token given",token)
    tokenService.verify(token, ACCESS_TOKEN_SECRET as string,function(err:any, _:any) {
        if (err) {
          console.log("WRONG TOKEN")
          // req.shoulRunMiddleware2=false;
          return next(new ErrorException(ErrorCode.Unauthorized,"The access token is not valid or is expired."))
          // return refreshTokenAuth(req,res,next)
        } 
        // req.shoulRunMiddleware2=false;
       return;
      });

      return next()
    } else {
      return next(new ErrorException(ErrorCode.AccessForbidden,"Access Forbidden . Error about headers"))
    }

      // req.shoulRunMiddleware2=false;
      // return;
    // } else {
    //     next(new ErrorException(ErrorCode.AccessForbidden,"Access Forbidden . Header is Missing"))
    // } 
   

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
        const user =  tokenService.verify(token, REFRESH_TOKEN_SECRET  as string);
        req.user = user;
        console.log("req.user", req.user);
        return
      } catch (err) {
        res.clearCookie("refresh_token");
        next(new ErrorException(ErrorCode.Unauthenticated,"Invalid credentials refreshtoken . Unauthorized access."))
      }
    }

  };
