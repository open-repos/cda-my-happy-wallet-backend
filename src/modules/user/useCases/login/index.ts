import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'
// import { authService } from '../../services';

import { Login } from './login'
import { LoginController } from './loginController'
import { refreshSessionService } from '../../../auth/refreshSession'

const userRepo = new UserRepo(prisma)
const login = new Login(userRepo, refreshSessionService)
const loginController = new LoginController(login)

export { login, loginController }
