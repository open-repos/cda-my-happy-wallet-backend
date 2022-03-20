import { createUserProps } from './../../../../utils/validators/register.validator';
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

            const result = await this.userRepo.create(props);
            // const {register_token, ...userInfo}=newUserInfo
            console.log('JUSTE APRES LE CREATE et avant le return succes true')
            return result
    }
}