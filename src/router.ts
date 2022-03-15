import {Router, Request, Response} from 'express';
import { notFoundRouter } from './routes/notFound';
// import { prisma } from './database';
import { userRouter } from './routes/user';
const mainRouter: Router = Router();

mainRouter.get("/", (_: Request,res: Response) => {
    res.send('voici la racine')
})

// mainRouter.get('/users', async (_:Request, res:Response) => {
//     const users = await prisma.utilisateur.findMany();
//     res.send(users);
// })

mainRouter.use('/users',userRouter)

mainRouter.use(notFoundRouter)

export  {mainRouter}




