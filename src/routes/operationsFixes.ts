import {Router, Request, Response} from 'express';
import { prisma } from '../database';
import { createOperationFixeController } from '../modules/operationsFixes/useCases/createOperationFixe'
import { updateOperationFixeController } from '../modules/operationsFixes/useCases/updateOperationFixe'
import { tokenJwtTAuth } from '../middleware/authenticateToken';
const operationFixeRouter: Router = Router();


//List operationsFixes
operationFixeRouter.get('/',tokenJwtTAuth, async (_:Request, res:Response) => {
    const operationsFixes = await prisma.operationFixe.findMany();
    res.send(operationsFixes);
})
//Create revenus
operationFixeRouter.post('/revenus',tokenJwtTAuth, (req, res) => createOperationFixeController.execute(req, res,"REVENU"))
operationFixeRouter.post('/charges',tokenJwtTAuth, (req, res) => createOperationFixeController.execute(req, res,"CHARGE"))

operationFixeRouter.put('/revenus/:id',(req, res) => updateOperationFixeController.execute(req, res,"REVENU"))
operationFixeRouter.put('/charges/:id',(req, res) => updateOperationFixeController.execute(req, res,"CHARGE"))
//Create chargesFixes
// operationFixeRouter.post('/charges-fixes', (req, res) => createOperationFixeController.execute(req, res))




export  {operationFixeRouter}