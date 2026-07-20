import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { IOperationFixeRepository } from '../../operationFixeRepository.interface';
import { Result, ResultCode } from '../../../../utils/results';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class DeleteOperationFixe {
    private operationFixeRepo: IOperationFixeRepository;
    private fctnCall:string="delete";


    constructor(operationFixeRepo: IOperationFixeRepository) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,userId:string,id:string,typeOperationFixe:string) {


        const idOperationFixe = parseInt(id);
        const operationProps = {
            ...props,
            id: idOperationFixe,
        };
        const exists = await this.operationFixeRepo.exists(idOperationFixe, parseInt(userId));
    
        if (exists) {
            await this.operationFixeRepo.delete(operationProps,userId,id,typeOperationFixe);
            const result = await new Result(
                ResultCode.Deleted,
                `${typeOperationFixe}`
            ).response_update();
            return result
        }
        
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} OperationFixe doesn't exist`)
    }
}
