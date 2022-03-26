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
// import { isResetTokenExpired } from "../middlewares/isResetTokenExpired.middleware";
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
  }
}


const userRouter: Router = Router();

// const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// Get list of users
userRouter.get("/", async (_: Request, res: Response) => {
  const users = await prisma.utilisateur.findMany();
  res.status(200).json({ success: true, data: users });
});
//Register User
userRouter.post(
  "/register",
  Validator("register"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(createUserController.execute(req, res, next)).catch(next)
);
// userRouter.post('/register',validateRequest(register), (req:Request, res:Response, next:NextFunction) => Promise.resolve(createUserController.execute(req, res)).catch(next))
//Authenticate
userRouter.get(
  "/verify/:id/:token",
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      confirmRegistrationUserController.execute(req, res, next)
    ).catch(next)
);
userRouter.post(
  "/authenticate",
  Validator("login"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(loginController.execute(req, res, next)).catch(next)
);
userRouter.post(
  "/reset-password",
  Validator("emailUser"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      resetPasswordUserController.execute(req, res, next)
    ).catch(next)
);
userRouter.get(
  "/reset-password/:token",
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(tokennewPasswordUserController.execute(req, res, next)).catch(next)
);
// isResetTokenExpired
userRouter.post(
  "/new-password",
  Validator("newPassword"),
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(
      newPasswordUserController.execute(req, res, next)
    ).catch(next)
);
// userRouter.post('/authenticate', asyncHandler(loginController.execute))

// userRouter.use('/users',userRouter)

export { userRouter };
