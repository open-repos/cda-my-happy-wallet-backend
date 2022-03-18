import {Router, Request, Response} from 'express';
import { operationFixeRouter } from './routes/operationsFixes';
import {renewAccessToken} from './modules/auth/accessTokenRenew'
import { userRouter } from './routes/user';
const mainRouter: Router = Router();

mainRouter.get("/", (_: Request,res: Response) => {
    res.send("Racine de l'API. ")
})

mainRouter.post("/token",renewAccessToken)

mainRouter.use('/users',userRouter)

mainRouter.use('/operations-fixes',operationFixeRouter)


// mainRouter.use(notFoundRouter)

export  {mainRouter}




