import {Router, Request, Response} from 'express';
import { prisma } from '../database';
import { createOperationFixeController } from '../modules/operationsFixes/useCases/createOperationFixe'
import { updateOperationFixeController } from '../modules/operationsFixes/useCases/updateOperationFixe'
import { readOperationFixeController } from '../modules/operationsFixes/useCases/readOperationFixe'
import { tokenJwtTAuth } from '../middleware/authenticateToken';
const operationFixeRouter: Router = Router();


// Read list operationsFixes
operationFixeRouter.get('/',tokenJwtTAuth, async (_:Request, res:Response) => {
    const operationsFixes = await prisma.operationFixe.findMany();
    res.send(operationsFixes);
})
//Create revenus / charges
operationFixeRouter.post('/revenus',tokenJwtTAuth, (req, res) => createOperationFixeController.execute(req, res,"REVENU"))
operationFixeRouter.post('/charges',tokenJwtTAuth, (req, res) => createOperationFixeController.execute(req, res,"CHARGE"))

// Update revenus / charges by ID
operationFixeRouter.put('/revenus/:id',(req, res) => updateOperationFixeController.execute(req, res,"REVENU"))
operationFixeRouter.put('/charges/:id',(req, res) => updateOperationFixeController.execute(req, res,"CHARGE"))

// Read revenus / charges by ID
operationFixeRouter.get('/revenus/:id',(req, res) =>readOperationFixeController.execute(req, res,"REVENU"))
operationFixeRouter.get('/charges/:id',(req, res) => readOperationFixeController.execute(req, res,"CHARGE"))




export  {operationFixeRouter}