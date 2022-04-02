// import { NextFunction } from 'express';
import { Result, ResultCode } from './../../../../utils/results/';
import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { UserRepo } from '../../userRepo'
import argon2 from 'argon2'
import { sign } from 'jsonwebtoken'
import { ACCESS_TOKEN_SECRET ,REFRESH_TOKEN_SECRET } from '../../../../config/config'
import {loginUserProps} from "../../../../utils/validators/login.validator"


//Equivalent to a specific service in a CRUD API
export class Login {
    private userRepo: UserRepo

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    //This is what our use case will do
    public async execute(props: loginUserProps) {
        // try {
            const { email, password } = props;
            console.log('email : ', email);
            console.log('password : ', password);

            const user = await this.userRepo.getUserByEmail(email);

            if (!user) {
                throw new ErrorException(ErrorCode.EmailPasswordNotValid);
            }

            // console.log('password user in database', user.password);
            // console.log('password in body', password);

            const passwordMatches = await argon2.verify(user.password,password)
            console.log('passwordMatches', passwordMatches);

            if (!passwordMatches) {
                throw new ErrorException(ErrorCode.EmailPasswordNotValid);
            }

            //Création de notre JWT token
            const expireIn="60s"
            const jwtToken = sign({ id: user.id }, ACCESS_TOKEN_SECRET as string, {expiresIn:expireIn})
            console.log('TOKEN', jwtToken);

            //Création de notre JWT token
            const refreshToken = sign({ id: user.id }, REFRESH_TOKEN_SECRET as string, {expiresIn:"15min"})
            console.log('REFRESH TOKEN', refreshToken);

            if (jwtToken){
                // const { id, password, ...userWithoutPasswordAndId } = user
                const{id,password,resetToken,resetTokenExpiration,created_at,updated_at,...userWithoutSensitiveInfo}=user
                console.log('user controller without id and password', userWithoutSensitiveInfo);
                const result_class = await new Result(ResultCode.Post, '',`Successfully authenticated`).response_post()
                result_class.payload = {
                    user:userWithoutSensitiveInfo,
                    accesToken: jwtToken,
                    expires:expireIn
                }
                
                const result = {
                    success: result_class.success,
                    // payload: {
                    //     user:userWithoutPasswordAndId,
                    //     accesToken: jwtToken,
                    //     expires:expireIn
                    // },
                    payload:result_class.payload,
                    refreshToken:refreshToken,
                    userId:user.id
                }
                return result
            }
           
            throw new ErrorException(ErrorCode.UnknownError);
    }
}