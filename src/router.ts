import {Router, Request, Response} from 'express';
// import { notFoundRouter } from './routes/notFound';
import { operationFixeRouter } from './routes/operationsFixes';
// import { prisma } from './database';
import { userRouter } from './routes/user';
const mainRouter: Router = Router();

mainRouter.get("/", (_: Request,res: Response) => {
    res.send("Racine de l'API. ")
})


// )
mainRouter.use('/users',userRouter)

mainRouter.use('/operations-fixes',operationFixeRouter)


// mainRouter.use(notFoundRouter)

export  {mainRouter}




