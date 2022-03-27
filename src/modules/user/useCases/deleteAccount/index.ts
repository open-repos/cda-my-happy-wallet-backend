import { DeleteAccount } from './deleteAccount';
import { UserRepo } from '../../userRepo'
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { prisma } from '../../../../database/index'
import { DeleteAccountController } from './deleteAccountController';

//Je construit mon repo avec les entités dont j'ai besoin
const operationFixeRepo = new UserRepo(prisma)
const deleteAccount = new DeleteAccount(operationFixeRepo)
const deleteAccountController = new DeleteAccountController(deleteAccount)

export { deleteAccount, deleteAccountController }