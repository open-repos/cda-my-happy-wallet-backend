import { DeleteOperationFixe } from './deleteOperationFixe';
import { OperationFixeRepo } from './../../operationFixeRepo';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { prisma } from '../../../../database/index'
import { DeleteOperationFixeController } from './deleteOperationFixeController';

//Je construit mon repo avec les entités dont j'ai besoin
const operationFixeRepo = new OperationFixeRepo(prisma)
const deleteOperationFixe = new DeleteOperationFixe(operationFixeRepo)
const deleteOperationFixeController = new DeleteOperationFixeController(deleteOperationFixe)

export { deleteOperationFixe, deleteOperationFixeController }