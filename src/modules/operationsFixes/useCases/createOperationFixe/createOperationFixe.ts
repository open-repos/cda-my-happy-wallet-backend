import { TypeOperationFixeEnum } from '@prisma/client';
import { OperationFixeProps } from './../../../../utils/validators/operationFixe.validator';
import { IOperationFixeRepository } from '../../operationFixeRepository.interface';
import { Result, ResultCode } from '../../../../utils/results';
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";


export class CreateOperationFixe {
    private operationFixeRepo: IOperationFixeRepository;

    constructor(operationFixeRepo: IOperationFixeRepository) {
        this.operationFixeRepo = operationFixeRepo
    }

    public async execute(props: OperationFixeProps,userId:string,typeOperationFixe:TypeOperationFixeEnum) {


            const operationFixe = await this.operationFixeRepo.create(props,userId,typeOperationFixe);
            const result = await new Result(
                ResultCode.Created,
                `${typeOperationFixe}`
            ).response_get();
            const { idOperationFixe, titre, montant, devise } = operationFixe;
            result.data = { idOperationFixe, titre, montant, devise };

            const [isRaVpastMonth, idRav]=  await this.operationFixeRepo.updateOrCreateRaV(userId)
            if(isRaVpastMonth){
                await this.operationFixeRepo.createRaV(userId)
                const resultRav = await new Result(
                    ResultCode.Created,
                    "Rest à Vivre Mis à jour"
                ).response_get();
                return  [result, resultRav] as const;
            }else{
                await this.operationFixeRepo.updateRaV(userId,idRav)
                const resultRav = await new Result(
                    ResultCode.Created,
                    "Rest à Vivre Mis à jour"
                ).response_get();
                return  [result, resultRav] as const;
            }

            

    }
}
