import { ErrorException, ErrorCode } from "./../../../../utils/errors/";
import { IOperationFixeRepository } from "../../operationFixeRepository.interface";
import { TypeOperationFixeEnum } from "@prisma/client";
import { Result, ResultCode } from "../../../../utils/results";
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";

export class ReadAllOperationFixe {
  private operationFixeRepo: IOperationFixeRepository;
  private fctnCall: string = "read";

  constructor(operationFixeRepo: IOperationFixeRepository) {
    this.operationFixeRepo = operationFixeRepo;
  }

  public async execute(userId: string, typeOperationFixe?:TypeOperationFixeEnum) {

    let result:any=undefined
    console.log("GET typeOperationFixe", typeOperationFixe)
    if(typeOperationFixe==undefined){
      const operationFixes = await this.operationFixeRepo.getAllOperationsFixes(userId);
      result = await new Result(
        ResultCode.Read,
        "All OperationsFixes"
      ).response_get();
      result.data = operationFixes;
      console.log("result find many operationsfixes",result)
    }

    if(typeOperationFixe=="CHARGE"){
      const operationFixes = await this.operationFixeRepo.getAllCharges(userId,typeOperationFixe);
      result = await new Result(
        ResultCode.Read,
        `All ${typeOperationFixe}`
      ).response_get();
      result.data = operationFixes;
      console.log("result find many operationsfixes",result)
    }

    if(typeOperationFixe=="REVENU"){
      const operationFixes = await this.operationFixeRepo.getAllRevenus(userId,typeOperationFixe);
      result = await new Result(
        ResultCode.Read,
        `All ${typeOperationFixe}`
      ).response_get();
      result.data = operationFixes;
      console.log("result find many operationsfixes",result)
    }
    
    console.log("result",result)
    if (result==null || result==undefined || result.length ===0){
        throw new ErrorException(
            ErrorCode.PrismaError,
            `${this.fctnCall} OperationsFixes doesn't exist`
          );
    }
    return result;
  
  }
}
