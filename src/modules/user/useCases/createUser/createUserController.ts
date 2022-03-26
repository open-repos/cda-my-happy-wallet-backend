import { ErrorException,ErrorCode } from "./../../../../utils/errors/";
import { NextFunction } from "express";
import { Result, ResultCode } from "./../../../../utils/results";
// gérer reception requête et renvoyer une réponse (logique HTTP)
// Route pour arriver dessus  http://localhost:3001/api/v1/users/
// Créer un objet sur cette route c'est POST http://localhost:3001/api/v1/users/
// Pour DELETE http://localhost:3001/api/v1/users/:id
// Pour UPDATE http://localhost:3001/api/v1/users/:id
import { CreateUser } from "./createUser";
import { Request, Response } from "express";

// swagger info
export const swRegisterUser = {
  tags: ["Users"],
  summary: "Register on application by given some personal infos",
  operationId: "registerUser",
  requestBody: {
    description: "Fill all fields in order to register to the application",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Register",
        },
      },
    },
    required: true,
  },
  responses: {
    "200": {
      description: new Result(ResultCode.Created,"","Successfully registered. Check your email to confirm your account").message,
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
export class CreateUserController {
  private useCase: CreateUser;

  constructor(createUser: CreateUser) {
    this.useCase = createUser;
  }

  public async execute(req: Request, res: Response, _: NextFunction) {
    console.log("Dans la fonction execute du CreateUserController");
    const result = await this.useCase.execute(req.body);
    console.log("result.success final", result.success);
    if (!result) {
      // return res.status(400).json({ message: result.message })
      throw new ErrorException(ErrorCode.UnknownError);
    }
    return res
      .status(201)
      .json({ succes: result.success, message: result.message });
    // return res.status(201).json({succes:result.success, message:result.message});
  }
}
