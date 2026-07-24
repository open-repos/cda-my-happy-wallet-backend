import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { IOperationFixeRepository } from '../../operationFixeRepository.interface';
import { Result, ResultCode } from '../../../../utils/results';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class ReadOperationFixe {
    private operationFixeRepo: IOperationFixeRepository;
    private fctnCall:string="read";


    constructor(operationFixeRepo: IOperationFixeRepository) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,userId:string,id:string,typeOperationFixe:string) {


        const exists = await this.operationFixeRepo.exists(props.id, parseInt(userId));
    
        if (exists) {
            const operationFixe = await this.operationFixeRepo.read(props,userId,id,typeOperationFixe);
            const result = await new Result(
                ResultCode.Read,
                `${typeOperationFixe}`
            ).response_get();
            result.data = operationFixe;
            return result
        }
        
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} OperationFixe doesn't exist`)
    }
}
