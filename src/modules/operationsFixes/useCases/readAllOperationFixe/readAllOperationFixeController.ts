// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/operation-fixes/
// Pour READ http://localhost:3001/api/v1/operation-fixes
import { ErrorException, ErrorCode } from './../../../../utils/errors/';
import { Result,ResultCode } from './../../../../utils/results/';
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


            console.log("Dans la fonction execute du operationController")
            const result = await this.useCase.execute(req.cookies.id_user,typeOperation);
            console.log('result.success final', result.success);

            return res.status(200).json(result);


    }
}


// DOCUMENTATION SWAGGER
export const swGetAllOperationFixe = {
    tags: ["OperationsFixe"],
    summary: "Get all operation fixe from user",
    operationId: "GetOperationFixe",
    responses: {
      "200": {
        description: new Result(ResultCode.Read,"All operationsFixes").message,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ListeOperationFixeResponse",
            },
          },
      } ,
    },
      "403": {
        description: new ErrorException(ErrorCode.Unauthorized).message,
      },
      "404": {
        description: new ErrorException(ErrorCode.NotFound).message,
      }
    },
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
    responses: {
      "200": {
        description: new Result(ResultCode.Read,"All Charges").message,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ListeChargeResponse",
            },
          },
      } ,
    },
      "403": {
        description: new ErrorException(ErrorCode.Unauthorized).message,
      },
      "404": {
        description: new ErrorException(ErrorCode.NotFound).message,
      }
    },
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
    responses: {
      "200": {
        description: new Result(ResultCode.Read,"All Incomes").message,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ListeRevenuResponse",
            },
          },
      } ,
    },
      "403": {
        description: new ErrorException(ErrorCode.Unauthorized).message,
      },
      "404": {
        description: new ErrorException(ErrorCode.NotFound).message,
      }
    },
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };