import { OperationFixeRepo } from '../../operationFixeRepo';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class CreateOperationFixe {
    private operationFixeRepo: OperationFixeRepo;

    constructor(operationFixeRepo: OperationFixeRepo) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,typeOperationFixe:string) {

        try {
            console.log('JUSTE AVNAT LE CREATE OPERATION')
            await this.operationFixeRepo.create(props,typeOperationFixe);
            //ICI PAS EXECUTEE
            console.log('JUSTE APRES LE CREATE et avant le return succes true')
            return {
                success: true,
                message: `operationFixe type of : ${typeOperationFixe} , is correctly created`
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