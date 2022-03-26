import { ReadAllOperationFixe } from './readAllOperationFixe';
import { OperationFixeRepo } from './../../operationFixeRepo';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { prisma } from '../../../../database/index'
import { ReadAllOperationFixeController } from './readAllOperationFixeController';

//Je construit mon repo avec les entités dont j'ai besoin
const operationFixeRepo = new OperationFixeRepo(prisma)
const readAllOperationFixe = new ReadAllOperationFixe(operationFixeRepo)
const readAllOperationFixeController = new ReadAllOperationFixeController(readAllOperationFixe)

export { readAllOperationFixe, readAllOperationFixeController }