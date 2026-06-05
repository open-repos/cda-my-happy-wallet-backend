import { TypeOperationFixeEnum } from '@prisma/client';
import { OperationFixeProps } from './../../../../utils/validators/operationFixe.validator';
import { IOperationFixeRepository } from '../../operationFixeRepository.interface';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class CreateOperationFixe {
    private operationFixeRepo: IOperationFixeRepository;

    constructor(operationFixeRepo: IOperationFixeRepository) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: OperationFixeProps,userId:string,typeOperationFixe:TypeOperationFixeEnum) {


            const result = await this.operationFixeRepo.create(props,userId,typeOperationFixe);

            const [isRaVpastMonth, idRav]=  await this.operationFixeRepo.updateOrCreateRaV(userId)
            if(isRaVpastMonth){
                const resultRav=  await this.operationFixeRepo.createRaV(userId)
                return  [result, resultRav] as const;
            }else{
                const resultRav=  await this.operationFixeRepo.updateRaV(userId,idRav)
                return  [result, resultRav] as const;
            }

            

    }
}
