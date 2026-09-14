import { Result , ResultCode} from './../../../../utils/results/';
import { ErrorException,ErrorCode }  from './../../../../utils/errors/';
import { NextFunction } from 'express';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id
import { TokenNewPasswordUser } from './tokennewPasswordUser'
import { Request, Response } from 'express'
import { authCookieOptions } from '../../../auth/authCookieOptions';


export const swResetPasswdTokenUser = {
    tags: ["Users"],
    summary: "Reset Password",
    operationId: "resetPasswordToken",
        parameters: [
      {
        "name": "Token",
        "in": "params",
        "description": "Check Token sent by email in params URL",
        "required": true,
        "schema": {
          "type": "string",
        }
      }],
    responses: {
      "200": {
        description: new Result(ResultCode.Read).message,
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
  };
//Controller
export class TokenNewPasswordUserController {
    private useCase: TokenNewPasswordUser;

    constructor(tokennewPasswordUser: TokenNewPasswordUser) {
        this.useCase = tokennewPasswordUser;
    }

    public async execute(req: Request, res: Response, _:NextFunction) {

            const result = await this.useCase.execute(req.params.token);
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            res.cookie("reset_token_password",req.params.token,authCookieOptions(900000))
            return res.status(201).json({succes:result.success, message:result.message});

    }
}
