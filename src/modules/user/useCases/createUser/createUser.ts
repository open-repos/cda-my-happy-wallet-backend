import { createUserProps } from './../../../../utils/validators/register.validator';
//Faire la logique du useCase (ici création utilisateur)import { UserRepo } from "../../userRepo";
import { Result, ResultCode } from './../../../../utils/results/';
import argon2 from 'argon2'
import { IUserRepository } from '../../userRepository.interface';
import { ErrorException,ErrorCode }  from '../../../../utils/errors/';
import {
    APP_BASE_URL,
    API_PUBLIC_URL,
    REGISTER_TOKEN,
  } from "./../../../../config/config";
import { ITokenService } from "../../../auth/token/TokenService.interface";
import { JsonWebTokenService } from "../../../auth/token/JsonWebTokenService";
// import { isRequestClean, validate } from '../../../../utils/validators/bodyRequestRegisterUser.validator';
export class CreateUser {
    private userRepo: IUserRepository;
    private tokenService: ITokenService;
    constructor(
        userRepo: IUserRepository,
        tokenService: ITokenService = new JsonWebTokenService()
    ) {
        this.userRepo = userRepo
        this.tokenService = tokenService
    }

    public async execute(props: createUserProps) {

            const userAlreadyExists = await this.userRepo.exists(props.email)
            const isAccountVerified = await this.userRepo.isUserAccountVerified(props.email)
            if (userAlreadyExists && isAccountVerified) {
                    throw new ErrorException(ErrorCode.EmailAlreadyTaken);
            }

            const hashPassword = await argon2.hash(props.password);

            props.password = hashPassword;

            let userId:number
            if (!userAlreadyExists) {
            const user = await this.userRepo.create(props);
            if(!user){
                throw new ErrorException(ErrorCode.PrismaError)
            }
            userId=user.id

            } else{
                const user = await this.userRepo.getUserByEmail(props.email);
            userId=user.id
            }

            // const {register_token, ...userInfo}=newUserInfo
            const expireIn = "5min";
            const jwtToken = this.tokenService.sign(
            { email: props.email },
            REGISTER_TOKEN as string,
            { expiresIn: expireIn }
            );
            // console.log("REGITER TOKEN", jwtToken);
            const verificationLink = `${API_PUBLIC_URL}${APP_BASE_URL}/users/verify/${userId}/${jwtToken}`;
            const emailToSend: string = props.email;
            const subject: string = "Confirmez votre inscription à MyHappyWallet";
            const message: string = `Bonjour ${props.firstname} ${props.lastname} ! 
            <br/>
            Merci pour votre inscription à MyHappyWallet
            <br/><br/>
            Pour verifier votre compte veuillez cliquez sur le lien suivant: 
            <a href="${verificationLink}">Lien de confirmation (expire dans ${expireIn})</a>
            <br/><br/>
            Je vous souhaite une bonne journée!`;

            const isEmailSent = await this.userRepo.sendMail(emailToSend, subject, message);

            if (!isEmailSent) {
            throw new ErrorException(ErrorCode.SendEmaillError);
            }
            return await new Result(ResultCode.Created,`Email was sent to ${emailToSend}`).response_post()

    }
}
