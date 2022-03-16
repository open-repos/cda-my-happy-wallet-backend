import { UpdateOperationFixe } from './updateOperationFixe';
import { OperationFixeRepo } from './../../operationFixeRepo';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { prisma } from '../../../../database/index'
import { UpdateOperationFixeController } from './updateOperationFixeController';

//Je construit mon repo avec les entités dont j'ai besoin
const operationFixeRepo = new OperationFixeRepo(prisma)
const updateOperationFixe = new UpdateOperationFixe(operationFixeRepo)
const updateOperationFixeController = new UpdateOperationFixeController(updateOperationFixe)

export { updateOperationFixe, updateOperationFixeController }