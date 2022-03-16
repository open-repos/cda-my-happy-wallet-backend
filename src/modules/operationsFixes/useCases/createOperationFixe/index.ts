import { CreateOperationFixe } from './createOperationFixe';
import { OperationFixeRepo } from './../../operationFixeRepo';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { prisma } from '../../../../database/index'
import { CreateOperationFixeController } from './createOperationFixeController';

//Je construit mon repo avec les entités dont j'ai besoin
const operationFixeRepo = new OperationFixeRepo(prisma)
const createOperationFixe = new CreateOperationFixe(operationFixeRepo)
const createOperationFixeController = new CreateOperationFixeController(createOperationFixe)

export { createOperationFixe, createOperationFixeController }