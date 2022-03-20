import {Router, Request, Response,NextFunction} from 'express';
import { Validator } from '../middlewares/validator.middleware';
import { prisma } from '../database';
import { createUserController } from '../modules/user/useCases/createUser'
import { loginController } from '../modules/user/useCases/login'

const userRouter: Router = Router();



// const asyncHandler = (fn: any) => (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// Get list of users
userRouter.get('/', async (_:Request, res:Response) => {
    const users = await prisma.utilisateur.findMany();
    res.send(users);
})
//Register User
userRouter.post('/register',Validator('register'), (req:Request, res:Response, next:NextFunction) => Promise.resolve(createUserController.execute(req, res)).catch(next))

//Authenticate
userRouter.post('/authenticate', (req:Request, res:Response, next:NextFunction) => Promise.resolve(loginController.execute(req,res,next)).catch(next))
// userRouter.post('/authenticate', asyncHandler(loginController.execute))

// userRouter.use('/users',userRouter)

export  {userRouter}
