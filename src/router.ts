import {Router, Request, Response} from 'express';
import { operationFixeRouter } from './routes/operationsFixes';
import {renewAccessToken, swRenewAccessToken} from './modules/auth/accessTokenRenew'
import { Validator } from './middlewares/validator.middleware';
import { userRouter, swGetListUser } from './routes/user';



export const swRenewTokenRouter = {
    "/token": {
      "post": {
        ...swRenewAccessToken
      }
    } ,
}

export const swAdminRouter = {
  "/users": {
    "get": {
      ...swGetListUser
    }
  } ,
}


const mainRouter: Router = Router();

mainRouter.get("/", (_: Request,res: Response) => {
    res.send("Racine de l'API. ")
})

mainRouter.post("/token",Validator("renewRefreshToken"),renewAccessToken)

mainRouter.use('/users',userRouter)

mainRouter.use('/operations-fixes',operationFixeRouter)


// mainRouter.use(notFoundRouter)

export  {mainRouter}




