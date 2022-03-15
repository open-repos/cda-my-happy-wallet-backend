import {Router, Request, Response} from 'express';
import { prisma } from '../database';
import { createUserController } from '../modules/user/useCases/createUser'
import { loginController } from '../modules/user/useCases/login'

const userRouter: Router = Router();

// Get list of users
userRouter.get('/', async (_:Request, res:Response) => {
    const users = await prisma.utilisateur.findMany();
    res.send(users);
})
//Register User
userRouter.post('/register', (req, res) => createUserController.execute(req, res))

//Authenticate
userRouter.post('/authenticate', (req, res) => loginController.execute(req, res))

// userRouter.use('/users',userRouter)

export  {userRouter}
