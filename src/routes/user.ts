import { ErrorException,ErrorCode } from './../utils/errors/';
import { Result, ResultCode } from './../utils/results/';
import { isAdmin } from './../middlewares/isAdmin.middleware';
import { tokenJwtTAuth } from './../middlewares/authenticateToken.middleware';
import { swnewPassdTokenUser } from './../modules/user/useCases/newPasswordUser/newPasswordUserController';
import { swResetPasswdTokenUser } from './../modules/user/useCases/tokenNewPasswordUser/tokennewPasswordUserController';
import { swResetUser } from './../modules/user/useCases/resetPasswordUser/resetPasswordUserController';
import { swLoginUser } from './../modules/user/useCases/login/loginController';
import { swConfirmRegistrationUser } from './../modules/user/useCases/confirmRegistrationUser/confirmRegistrationUserController';
// import { register } from '../utils/validators/index';
import { Router, Request, Response, NextFunction } from "express";
import { Validator } from "../middlewares/validator.middleware";
import { prisma } from "../database";
import { createUserController } from "../modules/user/useCases/createUser";
import { confirmRegistrationUserController } from "../modules/user/useCases/confirmRegistrationUser";
import {resetPasswordUserController} from "../modules/user/useCases/resetPasswordUser"
import { loginController } from "../modules/user/useCases/login";
import {newPasswordUserController} from "../modules/user/useCases/newPasswordUser"
import { swRegisterUser } from './../modules/user/useCases/createUser/createUserController';
import { tokennewPasswordUserController } from './../modules/user/useCases/tokenNewPasswordUser';
import { swDeleteAccount } from '../modules/user/useCases/deleteAccount/deleteAccountController';
import { deleteAccountController } from '../modules/user/useCases/deleteAccount';
import { logout, swLogout } from '../modules/auth/logout';
import {
  loginRateLimiter,
  passwordChangeRateLimiter,
  passwordResetRateLimiter,
  registrationRateLimiter,
  tokenValidationRateLimiter,
} from '../middlewares/authRateLimit.middleware';
// import {SchemasJoi} from "../utils/validators/index"
// const ApiUserEndpoints: string="/users"

export const swUserRouter = {
  "/users/register": {
    "post": {
      ...swRegisterUser
    }
  } ,
  "/users/verify/{id}/{token}": {
    "get": {
      ...swConfirmRegistrationUser
    }
  },
  "/users/authenticate": {
    "post": {
      ...swLoginUser
    }
  },
  "/users/reset-password": {
    "post": {
      ...swResetUser
    }
  },
  "/users/reset-password/{token}": {
    "get": {
      ...swResetPasswdTokenUser
    }
  },
  "/users/new-password": {
    "post": {
    ...swnewPassdTokenUser
    }
  },
  "/users/delete": {
    "delete": {
    ...swDeleteAccount
    }
  },
  "/users/logout": {
    "post": {
      ...swLogout
    }
  }
}


const userRouter: Router = Router();

// const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);
// Get list of users
userRouter.get("/",tokenJwtTAuth,isAdmin, async (_: Request, res: Response) => {
  const users = await prisma.utilisateur.findMany({
    select: {
      id: true,
      firstname: true,
      lastname: true,
      email: true,
      role: true,
      verified: true,
      created_at: true,
      updated_at: true,
    },
  });
  const result = await new Result(ResultCode.Read,"List of all users","",users).response_get()
  res.status(200).json(result);
});
//Register User
userRouter.post(
  "/register",
  registrationRateLimiter,
  Validator("register"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(createUserController.execute(req, res, next)).catch(next)
);
// userRouter.post('/register',validateRequest(register), (req:Request, res:Response, next:NextFunction) => Promise.resolve(createUserController.execute(req, res)).catch(next))
//Authenticate
userRouter.get(
  "/verify/:id/:token",
  tokenValidationRateLimiter,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      confirmRegistrationUserController.execute(req, res, next)
    ).catch(next)
);
userRouter.post(
  "/authenticate",
  loginRateLimiter,
  Validator("login"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(loginController.execute(req, res, next)).catch(next)
);
userRouter.post(
  "/logout",
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(logout(req, res, next)).catch(next)
);
userRouter.post(
  "/reset-password",
  passwordResetRateLimiter,
  Validator("emailUser"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      resetPasswordUserController.execute(req, res, next)
    ).catch(next)
);
userRouter.get(
  "/reset-password/:token",
  tokenValidationRateLimiter,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(tokennewPasswordUserController.execute(req, res, next)).catch(next)
);
userRouter.post(
  "/new-password",
  passwordChangeRateLimiter,
  Validator("newPassword"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      newPasswordUserController.execute(req, res, next)
    ).catch(next)
);

userRouter.delete(
  "/delete",
  tokenJwtTAuth,
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      deleteAccountController.execute(req, res)
    ).catch(next)
);
// userRouter.post('/authenticate', asyncHandler(loginController.execute))

// userRouter.use('/users',userRouter)

export { userRouter };


// DOCUMENTATION SWAGGER
export const swGetListUser = {
  tags: ["Users"],
  summary: "Get List of all Users (ADMIN Only)",
  operationId: "getListUsers",
  responses: {
    "200": {
      description: new Result(ResultCode.Read,"List of all User App").message,
  },
    "403": {
      description: new ErrorException(ErrorCode.Unauthorized).message,
    },
    "404": {
      description: new ErrorException(ErrorCode.NotFound).message,
    }
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
