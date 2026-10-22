import { ErrorException, ErrorCode } from "./../../../../utils/errors/";
import { IOperationFixeRepository } from "../../operationFixeRepository.interface";
import { Result, ResultCode } from "../../../../utils/results";
import { refreshLegacyRav } from "../../services/refreshLegacyRav";
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";

export class UpdateOperationFixe {
  private operationFixeRepo: IOperationFixeRepository;
  private fctnCall: string = "update";

  constructor(operationFixeRepo: IOperationFixeRepository) {
    this.operationFixeRepo = operationFixeRepo;
  }

  public async execute(
    props: any,
    userId: string,
    id: string,
    typeOperationFixe: string
  ) {
    const idUser = parseInt(userId);
    const exists = await this.operationFixeRepo.exists(
      +id,
      idUser,
      typeOperationFixe
    );

    if (exists) {
      const updated = await this.operationFixeRepo.update(
        props,
        userId,
        id,
        typeOperationFixe
      );
      if (updated.count !== 1) throw new ErrorException(ErrorCode.NotFound);
      await refreshLegacyRav(this.operationFixeRepo, userId);
      const result = await new Result(
        ResultCode.Updated,
        `${typeOperationFixe}`
      ).response_update();
      return result;
    }
    throw new ErrorException(
      ErrorCode.NotFound,
      `${this.fctnCall} OperationFixe doesn't exist`
    );
  }
}
