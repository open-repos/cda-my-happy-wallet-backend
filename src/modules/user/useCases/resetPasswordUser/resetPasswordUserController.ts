import { ErrorCode } from './../../../../utils/errors/errorCode.error';
import { ErrorException } from './../../../../utils/errors/errorException.error';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id

import { ResetPasswordUser } from './ResetPasswordUser'
import { Request, Response,NextFunction } from 'express'

//Controller
export class ResetPasswordUserController {
    private useCase: ResetPasswordUser;

    constructor(resetPasswordUser: ResetPasswordUser) {
        this.useCase = resetPasswordUser;
    }

    public async execute(req: Request, res: Response, _:NextFunction) {

            console.log("Dans la fonction execute du ResetPasswordController")
            const result = await this.useCase.execute(req.body.email);
            console.log('result.success final', result.success);
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            return res.status(201).json({succes:result.success, message:result.message});

    }
}