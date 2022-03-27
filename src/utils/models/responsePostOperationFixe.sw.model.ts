import { ErrorException, ErrorCode } from './../errors/';
import { Result ,ResultCode} from './../results/';


export const responseOperationFixePost= {
    "201": {
      description: new Result(ResultCode.Created).message,
    },
    "401": {
      $ref: "#/components/responses/UnauthorizedError401",
    },
    "400": {
      description: new ErrorException(ErrorCode.IncompleteRequestBody).message,
    },
    "403": {
      description: new ErrorException(ErrorCode.Unauthorized).message,
    },
    "404": {
      description: new ErrorException(ErrorCode.NotFound).message,
    },
    "405": {
      description: new ErrorException(ErrorCode.InvalidInput).message,
    },
  }