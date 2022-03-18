import { NODE_ENV } from '../../../../config/config';
import { Login } from './login'
import { Request, Response } from 'express'

// import { RequestLoginDto } from './loginDto'

export class LoginController {
    private useCase: Login;

    constructor(useCase: Login) {
        this.useCase = useCase
    }

    async execute(req: Request, res: Response): Promise<void | any> {
        try {
            // const requestUserDto = new RequestLoginDto(req.body);
            // const dtoErrors = await requestUserDto.isValid(requestUserDto)

            // if (!!dtoErrors) {
            //     return res.status(400).json(dtoErrors);
            // }

            const result = await this.useCase.execute(req.body)
            console.log("avant de check si success",result)
            if (!result.success) {
                return res.status(400).json({ message: result.message })
            }

            let data;

            if (result.payload) {
                const { id, password, ...userWithoutPasswordAndId } = result.payload.user
                console.log('user controller without id and password', userWithoutPasswordAndId);
                data = userWithoutPasswordAndId
                data.accessToken = result.payload?.accesToken
            }

            res.cookie("id_user",result.payload?.user.id,{
                httpOnly:true,
                secure:NODE_ENV === "production",
                maxAge: 900000 //15min

            })
            res.cookie("refresh_token",result.payload?.refreshToken,{
                httpOnly:true,
                secure:NODE_ENV === "production",
                maxAge: 900000 //15min

            })
            return res.status(200).json(data)

            // res.cookie(
            //     "refresh_token",
            //     user.refreshToken,
            //     { maxAge: 900000, httpOnly: true }
            // );

            // const { refreshToken, accessToken, ...userWithoutAccessAndRefreshToken } = user
        }
        catch (err) {
            //If something went wrong
            //Notify the client by throwing a correct status
            //Default controller error
        }
    }
}