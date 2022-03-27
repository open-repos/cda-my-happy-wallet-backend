import { ErrorException, ErrorCode } from '../errors';
import { Result ,ResultCode} from '../results';


type typeOpFixe = "Charge" | "Revenu"


export class ResponseOperationFixeGetById {
  public type:typeOpFixe;
  public jsonStruct:object;

  
  constructor(type:typeOpFixe="Charge"){
    this.type = type
    this.jsonStruct = {
      "200": {
        description: new Result(ResultCode.Read,`${this.type}`).message,
        content: {
          "application/json": {
            schema: {
              $ref: `#/components/schemas/${this.type}`,
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