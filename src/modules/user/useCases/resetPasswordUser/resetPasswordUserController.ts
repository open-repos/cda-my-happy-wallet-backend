import { Result , ResultCode} from './../../../../utils/results/';
import { ErrorException,ErrorCode }  from './../../../../utils/errors/';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id
import { ResetPasswordUser } from './resetPasswordUser'
import { Request, Response,NextFunction } from 'express'


export const swResetUser = {
    tags: ["Users"],
    summary: "Reset Password",
    operationId: "resetPassword",
    requestBody: {
      description: "Fill email about application account in order to receive email and choose new password ",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/ResetPassword",
          },
        },
      },
      required: true,
    },
    responses: {
      "200": {
        description: new Result(ResultCode.Created,"","Email sent to this email account").message,
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
export class ResetPasswordUserController {
    private useCase: ResetPasswordUser;

    constructor(resetPasswordUser: ResetPasswordUser) {
        this.useCase = resetPasswordUser;
    }

    public async execute(req: Request, res: Response, _:NextFunction) {

            const result = await this.useCase.execute(req.body.email);
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            return res.status(201).json({succes:result.success, message:result.message});

    }
}
