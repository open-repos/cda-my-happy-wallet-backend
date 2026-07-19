import { ResponseOperationFixeGet } from '../../../../utils/models/responseGetOperationFixe.sw.model';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/operation-fixes/
// Pour READ http://localhost:3001/api/v1/operation-fixes
import {ReadAllOperationFixe } from './readAllOperationFixe'
import { Request, Response } from 'express'
import { TypeOperationFixeEnum } from '@prisma/client';

//Controller
export class ReadAllOperationFixeController {
    private useCase: ReadAllOperationFixe;
    // private fctnCall:string="read";

    constructor(readOperationFixe: ReadAllOperationFixe) {
        this.useCase =readOperationFixe;
    }

    public async execute(req: Request, res: Response, typeOperation?:TypeOperationFixeEnum) {


            const result = await this.useCase.execute(req.cookies.id_user,typeOperation);

            return res.status(200).json(result);


    }
}


// DOCUMENTATION SWAGGER
export const swGetAllOperationFixe = {
    tags: ["OperationsFixe"],
    summary: "Get all operation fixe from user",
    operationId: "GetOperationFixe",
    responses: new ResponseOperationFixeGet("OperationFixe").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };


  export const swGetAllCharge = {
    tags: ["OperationsFixe"],
    summary: "Get all Charges from user",
    operationId: "GetAllCharge",
    responses: new ResponseOperationFixeGet("Charge").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };


  export const swGetAllRevenu = {
    tags: ["OperationsFixe"],
    summary: "Get all Revenus from user",
    operationId: "GetAllRevenu",
    responses: new ResponseOperationFixeGet("Revenu").jsonStruct,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };
