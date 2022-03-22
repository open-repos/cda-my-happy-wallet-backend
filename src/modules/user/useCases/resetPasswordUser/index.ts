// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { ResetPasswordUser } from './resetPasswordUser'
import { ResetPasswordUserController } from './resetPasswordUserController'
import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'

//Je construit mon repo avec les entités dont j'ai besoin
const userRepo = new UserRepo(prisma)
const resetPasswordUser = new ResetPasswordUser(userRepo)
const resetPasswordUserController = new ResetPasswordUserController(resetPasswordUser)

export { resetPasswordUser, resetPasswordUserController }