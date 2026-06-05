
import { ErrorException,ErrorCode } from './../../../../utils/errors/';
import { IOperationFixeRepository } from '../../operationFixeRepository.interface';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class UpdateOperationFixe {
    private operationFixeRepo: IOperationFixeRepository;
    private fctnCall:string="update";


    constructor(operationFixeRepo: IOperationFixeRepository) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,userId:string,id:string,typeOperationFixe:string) {

        const idUser = parseInt(userId)
        console.log(`${this.fctnCall} - ID operationFixe :`, props.id);
        console.log(`${this.fctnCall}- typeOperation selon l'appel d'API`, typeOperationFixe);
        console.log(
          `${this.fctnCall}- Contenu Props envoyé selon l'appel d'API`,
          props
        );
    
        const exists = await this.operationFixeRepo.exists(props.id, idUser);
        console.log("Operation exists ?", exists);
    
        if (exists) {
            console.log(`JUSTE AVNAT LE ${this.fctnCall} OPERATION`)
            const result =  await this.operationFixeRepo.update(props,userId,id,typeOperationFixe);
            console.log(`JUSTE APRES LE ${this.fctnCall} et avant le return succes true`)
            return result
        }
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} OperationFixe doesn't exist`)
            

    }
}
