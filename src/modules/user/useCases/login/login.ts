// import { NextFunction } from 'express';
import { Result, ResultCode } from './../../../../utils/results/';
import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { IUserRepository } from '../../userRepository.interface'
import argon2 from 'argon2'
import { ACCESS_TOKEN_SECRET ,REFRESH_TOKEN_SECRET } from '../../../../config/config'
import {loginUserProps} from "../../../../utils/validators/login.validator"
import { ITokenService } from '../../../auth/token/TokenService.interface';
import { JsonWebTokenService } from '../../../auth/token/JsonWebTokenService';


//Equivalent to a specific service in a CRUD API
export class Login {
    private userRepo: IUserRepository
    private tokenService: ITokenService

    constructor(
        userRepo: IUserRepository,
        tokenService: ITokenService = new JsonWebTokenService()
    ) {
        this.userRepo = userRepo
        this.tokenService = tokenService
    }

    //This is what our use case will do
    public async execute(props: loginUserProps) {
        // try {
            const { email, password } = props;

            const user = await this.userRepo.getUserByEmail(email);

            if (!user) {
                throw new ErrorException(ErrorCode.EmailPasswordNotValid);
            }

            const isAccountVerified = await this.userRepo.isUserAccountVerified(email)
            if (!isAccountVerified) {
                throw new ErrorException(ErrorCode.EmailPasswordNotValid);
            }
            // console.log('password user in database', user.password);
            // console.log('password in body', password);

            const passwordMatches = await argon2.verify(user.password,password)

            if (!passwordMatches) {
                throw new ErrorException(ErrorCode.EmailPasswordNotValid);
            }

            //Création de notre JWT token
            const expireIn="60s"
            const jwtToken = this.tokenService.sign({ id: user.id }, ACCESS_TOKEN_SECRET as string, {expiresIn:expireIn})

            //Création de notre JWT token
            const refreshToken = this.tokenService.sign({ id: user.id }, REFRESH_TOKEN_SECRET as string, {expiresIn:"15min"})

            if (jwtToken){
                // const { id, password, ...userWithoutPasswordAndId } = user
                const{id,password,resetToken,resetTokenExpiration,created_at,updated_at,...userWithoutSensitiveInfo}=user
                const result_class = await new Result(ResultCode.Post, '',`Successfully authenticated`).response_post()
                result_class.payload = {
                    user:userWithoutSensitiveInfo,
                    accessToken: jwtToken,
                    expires:expireIn
                }
                
                const result = {
                    success: result_class.success,
                    // payload: {
                    //     user:userWithoutPasswordAndId,
                    //     accessToken: jwtToken,
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
