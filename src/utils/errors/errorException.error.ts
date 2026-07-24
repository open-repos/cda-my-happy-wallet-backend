import { ErrorCode } from "./errorCode.error";
import { getErrorDefinition } from "./errorCatalog.error";

export class ErrorException extends Error {
  public status: number;
  public metaData: unknown;
  public message:string;

  constructor(
    name: string = ErrorCode.UnknownError,
    message:string = '',
    metaData: unknown = null,
  ) {
    super(name);
    Object.setPrototypeOf(this, new.target.prototype);
    const definition = getErrorDefinition(name);

    this.name = name;
    this.status = definition.status;
    this.metaData = metaData;
    this.message = message || definition.message;
  }

}
