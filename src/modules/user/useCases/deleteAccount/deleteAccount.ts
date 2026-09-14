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


        if(props.email == null){
            throw new ErrorException(ErrorCode.IncompleteRequestBody)
        }
        const exists = await this.userRepo.exists(props.email);
    
        if (exists) {
            await this.userRepo.delete(props.email,parseInt(userId));
            const result = await new Result(
                ResultCode.Deleted,
                `User with ${props.email} account`
            ).response_delete()
            return result
        }
        
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} User doesn't exist`)
    }
}
