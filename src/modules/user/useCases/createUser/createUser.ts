//Faire la logique du useCase (ici création utilisateur)import { UserRepo } from "../../userRepo";
import argon2 from 'argon2'
import { UserRepo } from '../../userRepo';

export class CreateUser {
    private userRepo: UserRepo;

    constructor(userRepo: UserRepo) {
        this.userRepo = userRepo
    }

    public async execute(props: any) {

        try {
            console.log("Dans fonction execute CreatUser",props);
            const userAlreadyExists = await this.userRepo.exists(props.email)
            console.log(`userAlreadyExists`,userAlreadyExists)
            if (userAlreadyExists) {
                return {
                    success: false,
                    message: 'User already exists'
                }
            }

            console.log('already exists ?',userAlreadyExists)

            const hashPassword = await argon2.hash(props.password);
            console.log('hashed password', hashPassword);

            props.password = hashPassword;

            console.log('JUSTE AVNAT LE CREATE')
            await this.userRepo.create(props);
            //ICI PAS EXECUTEE
            console.log('JUSTE APRES LE CREATE et avant le return succes true')
            return {
                success: true,
                message: 'User is correctly created'
            }
        }
        catch (err) {
            return {
                success: false,
                message: err
            }
        }
    }
}