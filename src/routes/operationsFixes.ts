import {Router, Request, Response} from 'express';
import { prisma } from '../database';
import { createOperationFixeController } from '../modules/operationsFixes/useCases/createOperationFixe'

const operationFixeRouter: Router = Router();

//List operationsFixes
operationFixeRouter.get('/', async (_:Request, res:Response) => {
    const operationsFixes = await prisma.operationFixe.findMany();
    res.send(operationsFixes);
})
//Create revenus
operationFixeRouter.post('/revenus', (req, res) => createOperationFixeController.execute(req, res,"REVENU"))
operationFixeRouter.post('/charges', (req, res) => createOperationFixeController.execute(req, res,"CHARGE"))
//Create chargesFixes
// operationFixeRouter.post('/charges-fixes', (req, res) => createOperationFixeController.execute(req, res))




export  {operationFixeRouter}