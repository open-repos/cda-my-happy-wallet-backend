import { ErrorCode } from "./errorCode.error";
// import { NODE_ENV } from "../../config/config";

export class ErrorException extends Error {
  public status: number;
  public metaData: any;
  public message:string;

  constructor(
    name: string = ErrorCode.UnknownError,
    message:string= "Unknown Error",
    metaData: any = null,
  ) {
    super(name);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = name;
    this.status = 500;
    this.metaData = metaData;
    this.message = message;
    switch (name) {
      case ErrorCode.WrongParamsID:
        this.status = 400;
        this.message = "Bad Request, wrong params id";
        break;
      case ErrorCode.IncompleteRequestBody:
          this.status = 400;
          // this.message = "Required request body content is missing";
          break;
      case ErrorCode.IncompleteRequestCookie:
            this.status = 400;
            // this.message = "Required request body content is missing";
            break;
      case ErrorCode.PrismaError:
            this.status = 400;
            // this.message = "Required request body content is missing";
            break;
      case ErrorCode.AsyncError:
        this.status = 400;
        this.message = "Bad Request";
        break;
      case ErrorCode.EmailPasswordNotValid:
        this.status = 401;
        this.message = "Email or password not valid";
        break;
      case ErrorCode.Unauthenticated:
        this.status = 401;
        this.message = "User Unauthenticated";
        break;
      case ErrorCode.Unauthorized:
          this.status = 401;
          // this.message = "User Unauthenticated";
          break;
      case ErrorCode.EmailAlreadyTaken:
        this.status = 403;
        this.message = "Email is already taken";
        break;
      case ErrorCode.AccessForbidden:
          this.status = 403;
          // this.message = "Access Forbidden";
          break;
      case ErrorCode.NotFound:
        this.status = 404;
        this.message = "The requested resource was not found";
        break;
      default:
        this.status = 500;
        this.message = "Unknown Error"
        break;
    }
    // if (NODE_ENV !== "production") {
    //   Error.captureStackTrace(this);
    // }
  }
}
