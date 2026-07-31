import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'
// import { authService } from '../../services';

import { Login } from './login'
import { LoginController } from './loginController'
import { PrismaRefreshSessionRepository } from '../../../auth/refreshSession/PrismaRefreshSessionRepository'
import { RefreshSessionService } from '../../../auth/refreshSession/RefreshSessionService'

const userRepo = new UserRepo(prisma)
const refreshSessionRepository = new PrismaRefreshSessionRepository(prisma)
const refreshSessionService = new RefreshSessionService(refreshSessionRepository)
const login = new Login(userRepo, refreshSessionService)
const loginController = new LoginController(login)

export { login, loginController }
