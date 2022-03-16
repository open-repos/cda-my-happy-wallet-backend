import { OperationFixeRepo } from '../../operationFixeRepo';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class UpdateOperationFixe {
    private operationFixeRepo: OperationFixeRepo;
    private fctnCall:string="update";


    constructor(operationFixeRepo: OperationFixeRepo) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,id:string,typeOperationFixe:string) {

        try {
            console.log(`JUSTE AVNAT LE ${this.fctnCall} OPERATION`)
            await this.operationFixeRepo.update(props,id,typeOperationFixe);
            console.log(`JUSTE APRES LE ${this.fctnCall} et avant le return succes true`)
            return {
                success: true,
                message: `operationFixe type of : ${typeOperationFixe} , is correctly ${this.fctnCall}`
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