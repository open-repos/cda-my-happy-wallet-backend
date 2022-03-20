import { ErrorCode } from './../../../../utils/errors/errorCode.error';
import { NextFunction } from 'express';
import { NODE_ENV } from '../../../../config/config';
import { Login } from './login'
import { Request, Response } from 'express'
import { ErrorException } from './../../../../utils/errors/errorException.error';


export class LoginController {
    private useCase: Login;

    constructor(useCase: Login) {
        this.useCase = useCase
    }

    async execute(req: Request, res: Response, _:NextFunction): Promise<void | any> {
            res.clearCookie("refresh_token");
            res.clearCookie("id_user");
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
                maxAge: 900000 //15min

            })
            res.cookie("refresh_token",result.refreshToken,{
                httpOnly:true,
                secure:NODE_ENV === "production",
                maxAge: 900000 //15min

            })

            return res.status(200).json({success:result.success,payload:result.payload})

    }
}