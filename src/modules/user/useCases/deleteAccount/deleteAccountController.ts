import { RespUpdateDelete } from '../../../../utils/models';
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/OperationFixes/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/OperationFixes/
// Pour DELETE http://localhost:3001/api/v1/OperationFixes/:id
// Pour UPDATE http://localhost:3001/api/v1/OperationFixes/:id
// Pour READ http://localhost:3001/api/v1/OperationFixes/:id

import {DeleteAccount } from './deleteAccount'
import { Request, Response } from 'express'
import { getAuthenticatedUserId } from '../../../auth/authenticatedRequest';
import { clearAuthCookie } from '../../../auth/authCookieOptions';


//Controller
export class DeleteAccountController {
    private useCase: DeleteAccount;
    // private fctnCall:string="read";

    constructor(deleteAccount: DeleteAccount) {
        this.useCase =deleteAccount;
    }

    public async execute(req: Request, res: Response) {


            const result = await this.useCase.execute(req.body,getAuthenticatedUserId(req));
            clearAuthCookie(res, "refresh_token");
            clearAuthCookie(res, "id_user");
            // res.clearCookie("role_user");
            return res.status(200).json(result);


    }
}

// DOCUMENTATION SWAGGER
export const swDeleteAccount = {
    tags: ["Users"],
    summary: "Delete Account with authorization access Token (Headers) and id Cookie",
    operationId: "DeleteAccount",
    requestBody: {
      description: "Fill email and userId about application account in order to delete user account ",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/DeleteEmailAccount",
          },
        },
      },
      required: true,
    },
    responses: new RespUpdateDelete("Delete").jsonStruct,
    security: [
      {
        accessToken_auth: [],
      },
      {
        userId: [],
        refreshToken: [],
      },
    ],
  };
