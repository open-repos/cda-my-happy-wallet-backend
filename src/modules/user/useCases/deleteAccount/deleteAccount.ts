import { ErrorException,ErrorCode } from '../../../../utils/errors';
import { Result, ResultCode } from '../../../../utils/results';
import { IUserRepository } from '../../userRepository.interface'
//Faire la logique du useCase (ici création utilisateur)import { userRepo } from "../../userRepo";


export class DeleteAccount {
    private userRepo: IUserRepository;
    private fctnCall:string="delete";


    constructor(userRepo: IUserRepository) {
        this.userRepo = userRepo
    }

    public async execute(props: any,userId:string) {


        console.log(`${this.fctnCall} - ID User :`, userId);
        console.log(
          `${this.fctnCall}- Contenu Props envoyé selon l'appel d'API`,
          props
        );
        if(props.email == null){
            throw new ErrorException(ErrorCode.IncompleteRequestBody)
        }
        const exists = await this.userRepo.exists(props.email);
        console.log("Operation exists ?", exists);
    
        if (exists) {
            console.log(`JUSTE AVNAT LE ${this.fctnCall} OPERATION`)
            await this.userRepo.delete(props.email,parseInt(userId));
            const result = await new Result(
                ResultCode.Deleted,
                `User with ${props.email} account`
            ).response_delete()
            console.log(`JUSTE APRES LE ${this.fctnCall} et avant le return succes true`)
            return result
        }
        
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} User doesn't exist`)
    }
}
