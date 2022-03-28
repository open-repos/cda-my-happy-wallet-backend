import { responseOperationFixePost, RequestOperationFixe } from './../../../../utils/models/index';
// gérer reception requête et renvoyer une réponse (logique HTTP)

import { CreateOperationFixe } from './createOperationFixe'
import { Request, Response } from 'express'

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


// DOCUMENTATION SWAGGER
export const swCreateCharge = {
    ...new RequestOperationFixe("Charge","Create","post").jsonStruct,
    responses: responseOperationFixePost,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };

export const swCreateRevenu = {
    ...new RequestOperationFixe("Revenu","Create","post").jsonStruct,
    responses: responseOperationFixePost,
    security: [
        {
          accessToken_auth: [],
        },
      ],
  };