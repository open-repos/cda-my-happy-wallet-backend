
import { ErrorException, ErrorCode } from './../errors/';
import { Result ,ResultCode} from './../results/';



type Method = "Delete" | "Update"


export class RespUpdateDelete {
  public type:Method;
  public jsonStruct:object;
  public message:string|undefined

  
  constructor(type:Method="Update"){
    this.type = type

    if(this.type=="Update"){
        this.message = new Result(ResultCode.Updated).message
      }else{
        this.message = new Result(ResultCode.Deleted).message
      }

    this.jsonStruct = {
      "200": {
        description: this.message
    
    },
    "401": {
        description: new ErrorException(ErrorCode.Unauthorized).message,
      },
      "403": {
        description: new ErrorException(ErrorCode.AccessForbidden).message,
      },
      "404": {
        description: new ErrorException(ErrorCode.NotFound).message,
      }
    }
  }
  
  }
