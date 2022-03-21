// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { ResetPasswordUser } from './ResetPasswordUser'
import { ResetPasswordUserController } from './ResetPasswordUserController'
import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'

//Je construit mon repo avec les entités dont j'ai besoin
const userRepo = new UserRepo(prisma)
const resetPasswordUser = new ResetPasswordUser(userRepo)
const resetPasswordUserController = new ResetPasswordUserController(resetPasswordUser)

export { resetPasswordUser, resetPasswordUserController }