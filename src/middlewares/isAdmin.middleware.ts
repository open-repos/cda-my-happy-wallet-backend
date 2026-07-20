import { ErrorException,ErrorCode } from './../utils/errors/';
import { Request, Response, NextFunction } from "express";
import { UserRepo } from '../modules/user/userRepo';
import { prisma } from '../database/';



export const isAdmin = async (
  req: Request,
  _: Response,
  next: NextFunction
) => {
  // if (NODE_ENV==="development"){
  //   console.log("MODE development : SKip middleware")
  //   return next()
  // }
  const userRepo = new UserRepo(prisma)
  const userId = req.cookies.id_user;
//   const userRole = req.cookies.role_user;
  if (userId!=null) {
    const user = await userRepo.getUserById(parseInt(userId))
    if (user==null) {
        return next(new ErrorException(ErrorCode.Unauthenticated))
    }
    if (user.role == "ADMIN"){
        return next()
    }
    return next(new ErrorException(ErrorCode.AccessForbidden,"Access Forbidden . User without authorization"))
    } else {
      return next(new ErrorException(ErrorCode.AccessForbidden,"Access Forbidden . User without authorization"))
    }

    }
