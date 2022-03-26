import { ErrorCode } from "./errorCode.error";
// import { NODE_ENV } from "../../config/config";

export class ErrorException extends Error {
  public status: number;
  public metaData: any;
  public message:string;

  constructor(
    name: string = ErrorCode.UnknownError,
    message:string = '',
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
        if (this.message=="")
        this.message = "Bad Request, wrong params id";
        break;
      case ErrorCode.IncompleteRequestBody:
      case ErrorCode.IncompleteRequestCookie:
      case ErrorCode.PrismaError:
            this.status = 400;
            if (this.message=="")
            this.message = "Bad Request";
            break;
      case ErrorCode.AsyncError:
        this.status = 400;
        if (this.message=="")
        this.message = "Bad Request";
        break;
      case ErrorCode.EmailNotFound:
          this.status = 401;
          if (this.message=="")
          this.message = "No account with that email.";
          break;
      case ErrorCode.EmailPasswordNotValid:
        this.status = 401;
        this.message = "Email or password not valid";
        break;
      case ErrorCode.Unauthenticated:
        this.status = 401;
        if (this.message=="")
        this.message = "User Unauthenticated";
        break;
      case ErrorCode.Unauthorized:
          this.status = 401;
          if (this.message=="")
          this.message = "User Unauthorized";
          break;
      case ErrorCode.EmailAlreadyTaken:
        this.status = 403;
        if (this.message=="")
        this.message = "Email is already taken";
        break;
      case ErrorCode.AccessForbidden:
          this.status = 403;
          if (this.message=="")
          this.message = "Access Forbidden";
          break;
      case ErrorCode.InvalidInput:
            this.status = 405;
            if (this.message=="")
            this.message = "Invalid Input";
            break;
      case ErrorCode.SendEmaillError:
            this.status = 500;
            if (this.message=="")
            this.message = "Email was not sent";
            break;
      case ErrorCode.NotFound:
        this.status = 404;
        if (this.message=="")
        this.message = "The requested resource was not found";
        break;
      default:
        this.status = 500;
        if (this.message=="")
        this.message = "Unknown Error"
        break;
    }
    // if (NODE_ENV !== "production") {
    //   Error.captureStackTrace(this);
    // }
  }

}
