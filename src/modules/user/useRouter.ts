//ROUTER DE MON USER 
import { Router } from 'express'
import { createUserController } from './useCases/createUser'
import { loginController } from './useCases/login/index'

const userRouter: Router = Router();

//Create
userRouter.post('/', (req, res) => createUserController.execute(req, res))

//Authenticate
userRouter.post('/authenticate', (req, res) => loginController.execute(req, res))

export { userRouter }