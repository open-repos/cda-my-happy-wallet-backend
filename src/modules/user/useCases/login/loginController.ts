import { Result, ResultCode } from './../../../../utils/results/';
import { NextFunction } from 'express';
import { NODE_ENV } from '../../../../config/config';
import { Login } from './login'
import { Request, Response } from 'express'
import { ErrorException,ErrorCode } from './../../../../utils/errors/';

export const swLoginUser = {
    tags: ["Users"],
    summary: "Login on application",
    operationId: "loginUser",
    requestBody: {
      description: "Fill email and password about your application account",
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/Login",
          },
        },
      },
      required: true,
    },
    responses: {
      "200": {
        description: new Result(ResultCode.Created,"","Successfully logged in").message,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/AuthResponse",
            },
          },
      } ,
      "headers": {
        "Set-Cookie":{
          "schema": {
            "type": "string",
            "example":{
              "refresh_token":"abcde12345", 
              "Path":"/",
              "HttpOnly":true
            } 
          }
          },
        "\0Set-Cookie":{
          "schema": {
            "type": "string",
            "example":{
              "id_user":"1", 
              "Path":"/",
              "HttpOnly":true
            } 
          }
          }
      }
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
  
export class LoginController {
    private useCase: Login;

    constructor(useCase: Login) {
        this.useCase = useCase
    }

    async execute(req: Request, res: Response, _:NextFunction): Promise<void | any> {
            res.clearCookie("refresh_token");
            res.clearCookie("id_user");
            // res.clearCookie("role_user");
            const result= await this.useCase.execute(req.body)
            console.log("avant de check si success",result)
            if (!result) {
                // return res.status(400).json({ message: result.message })
                throw new ErrorException(ErrorCode.UnknownError)
            }
            console.log(result.payload?.user.id)
            res.cookie("id_user",result.userId,{
                httpOnly:true,
                secure:NODE_ENV === "production",
                maxAge: 900000, //15min,
                sameSite: 'none'

            })
            res.cookie("refresh_token",result.refreshToken,{
                httpOnly:true,
                secure:NODE_ENV === "production",
                maxAge: 900000, //15min
                sameSite: 'none'

            })

          //   res.cookie("role_user",result.payload.user.role,{
          //     httpOnly:true,
          //     secure:NODE_ENV === "production",
          //     maxAge: 900000 //15min

          // })

            return res.status(200).json({success:result.success,payload:result.payload})

    }
}