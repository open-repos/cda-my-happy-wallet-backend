import { ReadOperationFixe } from './readOperationFixe';
import { OperationFixeRepo } from './../../operationFixeRepo';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { prisma } from '../../../../database/index'
import { ReadOperationFixeController } from './readOperationFixeController';

//Je construit mon repo avec les entités dont j'ai besoin
const operationFixeRepo = new OperationFixeRepo(prisma)
const readOperationFixe = new ReadOperationFixe(operationFixeRepo)
const readOperationFixeController = new ReadOperationFixeController(readOperationFixe)

export { readOperationFixe, readOperationFixeController }