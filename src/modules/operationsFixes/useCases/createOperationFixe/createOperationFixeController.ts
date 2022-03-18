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

        try {
            console.log("Dans la fonction execute du operationController")
            const result = await this.useCase.execute(req.body,req.cookies.id_user,typeOperation);
            console.log('result.success final', result.success);
            if (!result.success) {
                return res.status(400).json({ message: result })
            }
            return res.status(201).json(result);
        }
        catch (err) {
            console.log('create controllers errors :', err);
            return res.status(400).json({ message: err })
        }

    }
}