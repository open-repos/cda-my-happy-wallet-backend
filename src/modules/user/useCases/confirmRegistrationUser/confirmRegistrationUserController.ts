import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { ResultCode, Result } from './../../../../utils/results/';
import { NextFunction } from 'express';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id
import { ConfirmRegistrationUser } from './confirmRegistrationUser'
import { Request, Response } from 'express'


export const swConfirmRegistrationUser = {
    "summary": "Check valid email account",
    "description": "Confirm Registration by clicking on link received by email",
    "operationId": "verifyUserByUserIDandToken",
    "tags": [
      "Users"
    ],
    "parameters": [
      {
        "name": "userId",
        "in": "path",
        "description": "ID of user registered",
        "required": true,
        "schema": {
          "type": "integer",
          "format": "int64"
        }
      },
      {
        "name": "token",
        "in": "path",
        "description": "Token inside email to confirm registration account user",
        "required": true,
        "schema": {
          "type": "string",
        }
      },
    ],
      "responses": {
        "201": {
          "description": new Result(ResultCode.Created,'','User successfully registered').message
        },
        "404": {
          "description": new ErrorException(ErrorCode.NotFound).message
        }
      }
    }

//Controller
export class ConfirmRegistrationUserController {
    private useCase: ConfirmRegistrationUser;

    constructor(createUser: ConfirmRegistrationUser) {
        this.useCase = createUser;
    }

    public async execute(req: Request, res: Response, _:NextFunction) {

            console.log("Dans la fonction execute du CreateUserController")
            const result = await this.useCase.execute(req.params.id , req.params.token);
            // console.log('result.success final', result.success);
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            return res.status(201).json({succes:result.success, message:result.message});

    }
}