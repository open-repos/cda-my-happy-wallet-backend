//Faire la logique du useCase (ici création utilisateur)import { UserRepo } from "../../userRepo";
import argon2 from 'argon2'
import { UserRepo } from '../../userRepo';
import { ErrorException } from '../../../../utils/errors/errorException.error';
import { ErrorCode } from './../../../../utils/errors/errorCode.error';
// import { isRequestClean, validate } from '../../../../utils/validators/bodyRequestRegisterUser.validator';
export class CreateUser {
    private userRepo: UserRepo;

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    public async execute(props: any) {

        // try {
            console.log("Dans fonction execute CreatUser",props);
            const userAlreadyExists = await this.userRepo.exists(props.email)
            console.log(`userAlreadyExists`,userAlreadyExists)
            if (userAlreadyExists) {
                // return {
                //     success: false,
                //     message: `User with email: ${props.email} already exists`
                // }
                throw new ErrorException(ErrorCode.EmailAlreadyTaken);
            }

            console.log('already exists ?',userAlreadyExists)

            const hashPassword = await argon2.hash(props.password);
            console.log('hashed password', hashPassword);

            props.password = hashPassword;

            console.log('JUSTE AVANT LE CREATE')
            // const bodyClean = await isBodyTypeRegisterUser(props)
            // const isRqstClean:boolean = await isRequestClean(props)
            // if (isRqstClean) {
            //     // data is MyData here
            //     console.log(props)
            //   } else {
            //     console.log(validate.errors)
            //     throw new ErrorException(ErrorCode.IncompleteRequestBody,"Body Request is not properly written")
            //   }
            // if (!bodyClean) {
            //     throw new ErrorException(ErrorCode.IncompleteRequestBody)
            //   } 
            await this.userRepo.create(props);
            //ICI PAS EXECUTEE
            console.log('JUSTE APRES LE CREATE et avant le return succes true')
            return {
                success: true,
                message: `User with email: ${props.email} is correctly created`
            }
        // }
        // catch (err) {
        //     return {
        //         success: false,
        //         message: err
        //     }
        // }
    }
}