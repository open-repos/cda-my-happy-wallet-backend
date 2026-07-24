import { RespUpdateDelete } from './../../../../utils/models/';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/OperationFixes/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/OperationFixes/
// Pour DELETE http://localhost:3001/api/v1/OperationFixes/:id
// Pour UPDATE http://localhost:3001/api/v1/OperationFixes/:id
// Pour READ http://localhost:3001/api/v1/OperationFixes/:id

import {DeleteOperationFixe } from './deleteOperationFixe'
import { Request, Response } from 'express'
import { TypeOperationFixeEnum } from '@prisma/client';

//Controller
export class DeleteOperationFixeController {
    private useCase: DeleteOperationFixe;
    // private fctnCall:string="read";

    constructor(deleteOperationFixe: DeleteOperationFixe) {
        this.useCase =deleteOperationFixe;
    }

    public async execute(req: Request, res: Response,typeOperation:TypeOperationFixeEnum) {


            const result = await this.useCase.execute(req.body,req.cookies.id_user,req.params.id,typeOperation);

            return res.status(200).json(result);


    }
}

// DOCUMENTATION SWAGGER
export const swDeleteChargeById = {
    tags: ["OperationsFixe"],
    summary: "Delete Charges from user by Id",
    operationId: "DeleteChargeById",
    responses: new RespUpdateDelete("Delete").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };


  export const swDeleteRevenuById = {
    tags: ["OperationsFixe"],
    summary: "Delete Revenus from user by Id",
    operationId: "DeleteRevenuById",
    responses: new RespUpdateDelete("Delete").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };
