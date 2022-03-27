import { ErrorException, ErrorCode } from '../errors';
import { Result ,ResultCode} from '../results';


type typeOpFixe = "OperationFixe" | "Charge" | "Revenu"


export class ResponseOperationFixeGet {
  public type:typeOpFixe;
  public jsonStruct:object;

  
  constructor(type:typeOpFixe="OperationFixe"){
    this.type = type
    this.jsonStruct = {
      "200": {
        description: new Result(ResultCode.Read,`All ${this.type}`).message,
        content: {
          "application/json": {
            schema: {
              $ref: `#/components/schemas/Liste${this.type}Response`,
            },
          },
      } ,
    },
      "403": {
        description: new ErrorException(ErrorCode.Unauthorized).message,
      },
      "404": {
        description: new ErrorException(ErrorCode.NotFound).message,
      }
    }
  }
  
  }