import {
  IOperationFixeRepository,
  OperationFixeListItem,
} from "../../operationFixeRepository.interface";
import { TypeOperationFixeEnum } from "@prisma/client";
import { CursorPage, PaginationRequest } from "../../../pagination";

export class ReadAllOperationFixe {
  private operationFixeRepo: IOperationFixeRepository;
  constructor(operationFixeRepo: IOperationFixeRepository) {
    this.operationFixeRepo = operationFixeRepo;
  }

  public execute(
    userId: string,
    pagination: PaginationRequest,
    typeOperationFixe?: TypeOperationFixeEnum
  ): Promise<CursorPage<OperationFixeListItem>> {
    if (typeOperationFixe === "CHARGE") {
      return this.operationFixeRepo.getAllCharges(
        userId,
        typeOperationFixe,
        pagination
      );
    }
    if (typeOperationFixe === "REVENU") {
      return this.operationFixeRepo.getAllRevenus(
        userId,
        typeOperationFixe,
        pagination
      );
    }
    return this.operationFixeRepo.getAllOperationsFixes(userId, pagination);
  }
}
