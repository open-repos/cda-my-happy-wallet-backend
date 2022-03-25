import { OperationFixeRepo } from '../../operationFixeRepo';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class CreateOperationFixe {
    private operationFixeRepo: OperationFixeRepo;

    constructor(operationFixeRepo: OperationFixeRepo) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,userId:string,typeOperationFixe:string) {


            const result = await this.operationFixeRepo.create(props,userId,typeOperationFixe);
            
            return result

    }
}