import { RespUpdateDelete,RequestOperationFixe } from './../../../../utils/models/';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/OperationFixes/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/OperationFixes/
// Pour DELETE http://localhost:3001/api/v1/OperationFixes/:id
// Pour UPDATE http://localhost:3001/api/v1/OperationFixes/:id

import { UpdateOperationFixe } from './updateOperationFixe'
import {Request, Response } from 'express'
import { TypeOperationFixeEnum } from '@prisma/client';
import { getAuthenticatedUserId } from '../../../auth/authenticatedRequest';

//Controller
export class UpdateOperationFixeController {
    private useCase: UpdateOperationFixe;
    // private fctnCall:string="update";

    constructor(updateOperationFixe: UpdateOperationFixe) {
        this.useCase = updateOperationFixe;
    }

    public async execute(req: Request, res: Response,typeOperation:TypeOperationFixeEnum) {

        // try {
            const result = await this.useCase.execute(req.body,getAuthenticatedUserId(req),req.params.id,typeOperation);
            // if (!result.success) {
            //     return res.status(400).json({ message: result })
            // }
            return res.status(200).json(result);
        // }
        // catch (err) {
        //     console.log(`${this.fctnCall} controllers errors :`, err);
        //     return res.status(400).json({ message: err })
        // }

    }
}


// DOCUMENTATION SWAGGER
export const swUpdateChargeById = {
    ...new RequestOperationFixe("Charge","Update","put").jsonStruct,
    responses: new RespUpdateDelete('Update').jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };

export const swUpdateRevenuById = {
    ...new RequestOperationFixe("Revenu","Update","put").jsonStruct,
    responses: new RespUpdateDelete('Update').jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };
