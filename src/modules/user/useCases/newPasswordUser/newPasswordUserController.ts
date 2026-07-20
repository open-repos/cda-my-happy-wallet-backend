import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { Result, ResultCode } from './../../../../utils/results/';
import { NextFunction } from 'express';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id

import { NewPasswordUser } from './newPasswordUser'
import { Request, Response } from 'express'


export const swnewPassdTokenUser = {
    tags: ["Users"],
    summary: "New Password",
    operationId: "newPassword",
    requestBody: {
      description: "Choose new password ",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/NewPassword",
          },
        },
      },
      required: true,
    },
    responses: {
      "200": {
        description: new Result(ResultCode.Created,"","New password created").message,
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
    },
    security: [
      {
        "resetPsswdToken": []
      }
    ]
  };
//Controller
export class NewPasswordUserController {
    private useCase: NewPasswordUser;

    constructor(newPasswordUser: NewPasswordUser) {
        this.useCase = newPasswordUser;
    }

    public async execute(req: Request, res: Response, _:NextFunction) {

            const result = await this.useCase.execute(req.body.password, req.cookies.reset_token_password);
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            res.clearCookie("reset_token_password")
            return res.status(201).json({succes:result.success, message:result.message});

    }
}
