// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { ConfirmRegistrationUser } from './confirmRegistrationUser'
import { ConfirmRegistrationUserController } from './confirmRegistrationUserController'
import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'

//Je construit mon repo avec les entités dont j'ai besoin
const userRepo = new UserRepo(prisma)
const confirmRegistrationUser = new ConfirmRegistrationUser(userRepo)
const confirmRegistrationUserController = new ConfirmRegistrationUserController(confirmRegistrationUser)

export { confirmRegistrationUser, confirmRegistrationUserController }