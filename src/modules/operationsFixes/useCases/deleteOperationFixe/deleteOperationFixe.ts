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
        console.log(`${this.fctnCall} - ID operationFixe :`, operationProps.id);
        console.log(`${this.fctnCall}- typeOperation selon l'appel d'API`, typeOperationFixe);
        console.log(
          `${this.fctnCall}- Contenu Props envoyé selon l'appel d'API`,
          operationProps
        );
        const exists = await this.operationFixeRepo.exists(idOperationFixe, parseInt(userId));
        console.log("Operation exists ?", exists);
    
        if (exists) {
            console.log(`JUSTE AVNAT LE ${this.fctnCall} OPERATION`)
            await this.operationFixeRepo.delete(operationProps,userId,id,typeOperationFixe);
            const result = await new Result(
                ResultCode.Deleted,
                `${typeOperationFixe}`
            ).response_update();
            console.log(`JUSTE APRES LE ${this.fctnCall} et avant le return succes true`)
            return result
        }
        
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} OperationFixe doesn't exist`)
    }
}
