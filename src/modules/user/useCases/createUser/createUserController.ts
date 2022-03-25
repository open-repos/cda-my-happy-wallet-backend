import { ErrorCode } from './../../../../utils/errors/errorCode.error';
import { ErrorException } from './../../../../utils/errors/errorException.error';
import { NextFunction } from 'express';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id

import { CreateUser } from './createUser'
import { Request, Response } from 'express'

//Controller
export class CreateUserController {
    private useCase: CreateUser;

    constructor(createUser: CreateUser) {
        this.useCase = createUser;
    }

    public async execute(req: Request, res: Response, _:NextFunction) {

            console.log("Dans la fonction execute du CreateUserController")
            const result = await this.useCase.execute(req.body);
            console.log('result.success final', result.success);
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            return res.status(201).json({succes:result.success, message:result.message})
            // return res.status(201).json({succes:result.success, message:result.message});

    }
}