import { createUserProps } from './../../../../utils/validators/register.validator';
//Faire la logique du useCase (ici création utilisateur)import { UserRepo } from "../../userRepo";
import { Result, ResultCode } from './../../../../utils/results/';
import argon2 from 'argon2'
import { UserRepo } from '../../userRepo';
import { ErrorException,ErrorCode }  from '../../../../utils/errors/';
import {
    PORT,
    APP_BASE_URL,
    REGISTER_TOKEN,
  } from "./../../../../config/config";
  import { sign } from "jsonwebtoken";
// import { isRequestClean, validate } from '../../../../utils/validators/bodyRequestRegisterUser.validator';
export class CreateUser {
    private userRepo: UserRepo;

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    public async execute(props: createUserProps) {

            console.log("Dans fonction execute CreatUser",props);
            const userAlreadyExists = await this.userRepo.exists(props.email)
            console.log(`userAlreadyExists`,userAlreadyExists)
            if (userAlreadyExists) {
                throw new ErrorException(ErrorCode.EmailAlreadyTaken);
            }

            console.log('already exists ?',userAlreadyExists)

            const hashPassword = await argon2.hash(props.password);
            console.log('hashed password', hashPassword);

            props.password = hashPassword;

            console.log('JUSTE AVANT LE CREATE')

            const user = await this.userRepo.create(props);

            if(!user){
                throw new ErrorException(ErrorCode.PrismaError)
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

            const verificationLink = `http://localhost:${PORT}${APP_BASE_URL}/users/verify/${user.id}/${jwtToken}`;
            const emailToSend: string = "andria.capai@gmail.com"; // userProps.email
            const subject: string = "Confirmez votre inscription à MyHappyWallet";
            const message: string = `Hi there
            <br/>
            Merci pour votre inscription à MyHappyWallet
            <br/><br/>
            Pour verifier votre compte veuillez cliquez sur le lien suivant: 
            <a href="${verificationLink}">Lien de confirmation</a>
            <br/><br/>
            Je vous souhaite une bonne journée!`;

            const isEmailSent = await this.userRepo.sendMail(emailToSend, subject, message);

            if (!isEmailSent) {
            throw new ErrorException(ErrorCode.SendEmaillError);
            }
            return await new Result(ResultCode.Created,`Email was sent to ${emailToSend}`).response_post()

    }
}