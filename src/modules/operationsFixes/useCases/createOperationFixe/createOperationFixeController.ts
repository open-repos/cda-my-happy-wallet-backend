import { Result, ResultCode } from './../../../../utils/results/';
import { ErrorException, ErrorCode } from './../../../../utils/errors/';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/OperationFixes/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/OperationFixes/
// Pour DELETE http://localhost:3001/api/v1/OperationFixes/:id
// Pour UPDATE http://localhost:3001/api/v1/OperationFixes/:id

import { CreateOperationFixe } from './createOperationFixe'
import { Request, Response } from 'express'
// import { validate } from 'class-validator'

//DTO
// import { RequestCreateOperationFixeDto } from './createOperationFixeDto'

// type typeOperationFixeProps = {
//     type:string
// }

//Controller
export class CreateOperationFixeController {
    private useCase: CreateOperationFixe;

    constructor(createOperationFixe: CreateOperationFixe) {
        this.useCase = createOperationFixe;
    }

    public async execute(req: Request, res: Response,typeOperation:string) {

            console.log("Dans la fonction execute du operationController")
            const result = await this.useCase.execute(req.body,req.cookies.id_user,typeOperation);
            console.log('result.success final', result.success);
            if (!result.success) {
                return res.status(400).json({ message: result })
            }
            return res.status(201).json(result);

    }
}


// swagger info
export const swCreateCharge = {
    tags: ["OperationsFixe"],
    summary: "Create charge",
    operationId: "postCharge",
    requestBody: {
      description: "Fill all fields in order to create charge",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/Charge",
          },
        },
      },
      required: true,
    },
    responses: {
      "200": {
        description: new Result(ResultCode.Created).message,
      },
      "401": {
        $ref: "#/components/responses/UnauthorizedError401",
      },
      "400": {
        description: new ErrorException(ErrorCode.IncompleteRequestBody).message,
      },
      "403": {
        description: new ErrorException(ErrorCode.Unauthorized).message,
      },
      "404": {
        description: new ErrorException(ErrorCode.NotFound).message,
      },
      "405": {
        description: new ErrorException(ErrorCode.InvalidInput).message,
      },
    }
  };