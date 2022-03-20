import { OperationFixeRepo } from '../../operationFixeRepo';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class ReadOperationFixe {
    private operationFixeRepo: OperationFixeRepo;
    private fctnCall:string="read";


    constructor(operationFixeRepo: OperationFixeRepo) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: any,userId:string,id:string,typeOperationFixe:string) {

        // try {
            console.log(`JUSTE AVNAT LE ${this.fctnCall} OPERATION`)
            const result =await this.operationFixeRepo.read(props,userId,id,typeOperationFixe);
            console.log(`JUSTE APRES LE ${this.fctnCall} et avant le return succes true`)
            return {
                success: true,
                message: `operationFixe type of : ${typeOperationFixe} , is correctly ${this.fctnCall}`,
                result: result

            }
        // }
        // catch (err) {
        //     return {
        //         success: false,
        //         message: err
        //     }
        // }
    }
}