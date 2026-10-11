import {Router, Request, Response} from 'express';
import { operationFixeRouter } from './routes/operationsFixes';
import {renewAccessToken, swRenewAccessToken} from './modules/auth/accessTokenRenew'
import { Validator } from './middlewares/validator.middleware';
import { userRouter, swGetListUser } from './routes/user';
import { refreshRateLimiter } from './middlewares/authRateLimit.middleware';
import { nativeSessionRouter } from './routes/nativeSession';
import { oneOffOperationRouter } from './routes/oneOffOperations';
import { monthlyEventRouter } from './routes/monthlyEvents';
import { financialGoalRouter } from './routes/financialGoals';
import { budgetPeriodRouter } from './routes/budgetPeriods';
import { analyticsRouter } from './routes/analytics';
import { eventOccurrenceRouter } from './routes/eventOccurrences';



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
    // res.redirect('/api-docs');
})

mainRouter.post("/token",refreshRateLimiter,Validator("renewRefreshToken"),renewAccessToken)

mainRouter.use('/auth/native', nativeSessionRouter)

mainRouter.use('/users',userRouter)

mainRouter.use('/operations-fixes',operationFixeRouter)

mainRouter.use('/', oneOffOperationRouter)
mainRouter.use('/', eventOccurrenceRouter)
mainRouter.use('/', monthlyEventRouter)
mainRouter.use('/', financialGoalRouter)
mainRouter.use('/', budgetPeriodRouter)
mainRouter.use('/', analyticsRouter)


// mainRouter.use(notFoundRouter)

export  {mainRouter}
