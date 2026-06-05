import { createUserProps } from './../../../../utils/validators/register.validator';
//Faire la logique du useCase (ici création utilisateur)import { UserRepo } from "../../userRepo";
import { Result, ResultCode } from './../../../../utils/results/';
import argon2 from 'argon2'
import { IUserRepository } from '../../userRepository.interface';
import { ErrorException,ErrorCode }  from '../../../../utils/errors/';
import {
    APP_BASE_URL,
    REGISTER_TOKEN,
    NODE_ENV,
  } from "./../../../../config/config";
  import { sign } from "jsonwebtoken";
// import { isRequestClean, validate } from '../../../../utils/validators/bodyRequestRegisterUser.validator';
export class CreateUser {
    private userRepo: IUserRepository;
    constructor(userRepo: IUserRepository) {
        this.userRepo = userRepo
    }

    public async execute(props: createUserProps) {

            console.log("Dans fonction execute CreatUser",props);
            const userAlreadyExists = await this.userRepo.exists(props.email)
            console.log(`userAlreadyExists`,userAlreadyExists)
            const isAccountVerified = await this.userRepo.isUserAccountVerified(props.email)
            console.log("isaccountverified",isAccountVerified)
            if (userAlreadyExists && isAccountVerified) {
                    throw new ErrorException(ErrorCode.EmailAlreadyTaken);
            }

            console.log('already exists ?',userAlreadyExists)

            const hashPassword = await argon2.hash(props.password);
            console.log('hashed password', hashPassword);

            props.password = hashPassword;

            console.log('JUSTE AVANT LE CREATE')

            let userId:number
            console.log("!isAccountVerified && userAlreadyExists!",!isAccountVerified && userAlreadyExists!)
            if (!userAlreadyExists) {
                console.log("!isAccountVerified && userAlreadyExists!",!isAccountVerified && userAlreadyExists!)
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
            console.log('JUSTE APRES LE CREATE et avant le return succes true')
            

            const expireIn = "5min";
            const jwtToken = sign(
            { email: props.email },
            REGISTER_TOKEN as string,
            { expiresIn: expireIn }
            );
            // console.log("REGITER TOKEN", jwtToken);
            let verificationLink=``
            if (NODE_ENV=="production"){
                verificationLink = `https://api.myhappywallet.andriacapai.com${APP_BASE_URL}/users/verify/${userId}/${jwtToken}`;
            }else{
                // verificationLink = `https://api.myhappywallet.andriacapai.com${APP_BASE_URL}/users/verify/${user.id}/${jwtToken}`;
                verificationLink = `http://localhost:4200${APP_BASE_URL}/users/verify/${userId}/${jwtToken}`;
            }
            const emailToSend: string = "andria.capai@gmail.com"; // userProps.email
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
