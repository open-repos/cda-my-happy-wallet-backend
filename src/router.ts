import {Router, Request, Response} from 'express';
import { prisma } from './database';
import { userRouter } from './modules/user/useRouter';
const mainRouter: Router = Router();

mainRouter.get("/", (_: Request,res: Response) => {
    res.send('voici la racine')
})

mainRouter.get('/users', async (_:Request, res:Response) => {
    const users = await prisma.utilisateur.findMany();
    res.send(users);
})

mainRouter.use('/users',userRouter)

export  {mainRouter}




