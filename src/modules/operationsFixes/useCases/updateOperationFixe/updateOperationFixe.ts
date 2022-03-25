
import { ErrorCode } from './../../../../utils/errors/errorCode.error';
import { ErrorException } from './../../../../utils/errors/errorException.error';
import { OperationFixeRepo } from '../../operationFixeRepo';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class UpdateOperationFixe {
    private operationFixeRepo: OperationFixeRepo;
    private fctnCall:string="update";


    constructor(operationFixeRepo: OperationFixeRepo) {
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
            const result =  await this.operationFixeRepo.update(props,userId,id);
            console.log(`JUSTE APRES LE ${this.fctnCall} et avant le return succes true`)
            return result
        }
        throw new ErrorException(ErrorCode.PrismaError,`${this.fctnCall} OperationFixe doesn't exist`)
            

    }
}