// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { NewPasswordUser } from './newPasswordUser'
import { NewPasswordUserController } from './newPasswordUserController'
import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'

//Je construit mon repo avec les entités dont j'ai besoin
const userRepo = new UserRepo(prisma)
const newPasswordUser = new NewPasswordUser(userRepo)
const newPasswordUserController = new NewPasswordUserController(newPasswordUser)

export { newPasswordUser, newPasswordUserController }