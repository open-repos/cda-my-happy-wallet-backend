import {ResponseOperationFixeGetById } from '../../../../utils/models/responseGetByIdOperationFixe.sw.model';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/OperationFixes/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/OperationFixes/
// Pour DELETE http://localhost:3001/api/v1/OperationFixes/:id
// Pour UPDATE http://localhost:3001/api/v1/OperationFixes/:id
// Pour READ http://localhost:3001/api/v1/OperationFixes/:id

import {ReadOperationFixe } from './readOperationFixe'
import { Request, Response } from 'express'
import { TypeOperationFixeEnum } from '@prisma/client';
import { getAuthenticatedUserId } from '../../../auth/authenticatedRequest';

//Controller
export class ReadOperationFixeController {
    private useCase: ReadOperationFixe;
    // private fctnCall:string="read";

    constructor(readOperationFixe: ReadOperationFixe) {
        this.useCase =readOperationFixe;
    }

    public async execute(req: Request, res: Response,typeOperation:TypeOperationFixeEnum) {


            const result = await this.useCase.execute(req.body,getAuthenticatedUserId(req),req.params.id,typeOperation);

            return res.status(200).json(result);


    }
}

// DOCUMENTATION SWAGGER
export const swGetChargeById = {
    tags: ["OperationsFixe"],
    summary: "Get Charges from user by Id",
    operationId: "GetChargeById",
    responses: new ResponseOperationFixeGetById("Charge").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };


  export const swGetRevenuById = {
    tags: ["OperationsFixe"],
    summary: "Get Revenus from user by Id",
    operationId: "GetRevenuById",
    responses: new ResponseOperationFixeGetById("Revenu").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };
