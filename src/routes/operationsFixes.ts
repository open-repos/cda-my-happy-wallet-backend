import { ErrorException,ErrorCode } from './../utils/errors/';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../database';
import { createOperationFixeController } from '../modules/operationsFixes/useCases/createOperationFixe'
import { updateOperationFixeController } from '../modules/operationsFixes/useCases/updateOperationFixe'
import { readOperationFixeController } from '../modules/operationsFixes/useCases/readOperationFixe'
import { tokenJwtTAuth } from '../middlewares/authenticateToken.middleware';
import { Validator } from '../middlewares/validator.middleware';

const operationFixeRouter: Router = Router();


// Read list operationsFixes
operationFixeRouter.get('/',tokenJwtTAuth,async (_:Request,res:Response, next:NextFunction) => {
         await prisma.operationFixe.findMany()
            .then((operationFixes:any)=> {return res.json(operationFixes)})
            .catch((_:any)=>next(new ErrorException(ErrorCode.UnknownError)));
    }
)
//Create revenus / charges
operationFixeRouter.post('/revenus',tokenJwtTAuth,Validator("operationFixe"), (req:Request, res:Response, next:NextFunction) => Promise.resolve(createOperationFixeController.execute(req, res,"REVENU")).catch(next))
operationFixeRouter.post('/charges',tokenJwtTAuth,Validator("operationFixe"),  (req:Request, res:Response, next:NextFunction)=> Promise.resolve(createOperationFixeController.execute(req, res,"CHARGE")).catch(next))

// Update revenus / charges by ID
operationFixeRouter.put('/revenus/:id',Validator("operationFixe"), (req:Request, res:Response, next:NextFunction)=> Promise.resolve(updateOperationFixeController.execute(req, res,"REVENU")).catch(next))
operationFixeRouter.put('/charges/:id',Validator("operationFixe"), (req:Request, res:Response, next:NextFunction) => Promise.resolve(updateOperationFixeController.execute(req, res,"CHARGE")).catch(next))

// Read revenus / charges by ID
operationFixeRouter.get('/revenus/:id',tokenJwtTAuth, (req:Request, res:Response, next:NextFunction) =>Promise.resolve(readOperationFixeController.execute(req, res,"REVENU")).catch(next))
operationFixeRouter.get('/charges/:id',tokenJwtTAuth, (req:Request, res:Response, next:NextFunction) => Promise.resolve(readOperationFixeController.execute(req, res,"CHARGE")).catch(next))




export  {operationFixeRouter}