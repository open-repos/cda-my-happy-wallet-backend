import { ErrorException, ErrorCode } from "./../../../../utils/errors/";
import { OperationFixeRepo } from "../../operationFixeRepo";
import { TypeOperationFixeEnum } from "@prisma/client";
//Faire la logique du useCase (ici création utilisateur)import { OperationFixeRepo } from "../../OperationFixeRepo";

export class ReadAllOperationFixe {
  private operationFixeRepo: OperationFixeRepo;
  private fctnCall: string = "read";

  constructor(operationFixeRepo: OperationFixeRepo) {
    this.operationFixeRepo = operationFixeRepo;
  }

  public async execute(userId: string, typeOperationFixe?:TypeOperationFixeEnum) {

    let result:any=undefined
    console.log("GET typeOperationFixe", typeOperationFixe)
    if(typeOperationFixe==undefined){
      result = await this.operationFixeRepo.getAllOperationsFixes(userId);
      console.log("result find many operationsfixes",result)
    }

    if(typeOperationFixe=="CHARGE"){
     result = await this.operationFixeRepo.getAllCharges(userId,typeOperationFixe);
      console.log("result find many operationsfixes",result)
    }

    if(typeOperationFixe=="REVENU"){
      result = await this.operationFixeRepo.getAllRevenus(userId,typeOperationFixe);
      console.log("result find many operationsfixes",result)
    }
    
    console.log("result",result)
    if (result==null || result==undefined){
        throw new ErrorException(
            ErrorCode.PrismaError,
            `${this.fctnCall} OperationsFixes doesn't exist`
          );
    }
    return result;
  
  }
}
