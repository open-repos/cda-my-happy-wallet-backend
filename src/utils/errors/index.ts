import { ErrorCode } from "./errorCode.error";
import { ErrorException } from "./errorException.error";
import Joi from "joi";
import j2s from "joi-to-swagger";

type nestedErrorProps = {
  type: string;
  path: string;
  statusCode: number;
  message: string;
};
type errorProps = {
  response: string;
  error: nestedErrorProps;
};

const nestedErorrSchema = Joi.object<nestedErrorProps>({
  type: Joi.string().example("NotFound"),
  path: Joi.string().example("/users/register/krl"),
  statusCode: Joi.number().example(404),
  message: Joi.number().example("Request not found"),
});

const errorSchema = Joi.object<errorProps>({
  response: Joi.string().example("error"),
  error: nestedErorrSchema,
});

export const errorSchemaSwg = j2s(errorSchema).swagger;
export class ErrorSchemaSwg {
  public path: string;
  public errorClass: ErrorException;
  constructor(
    path: string = "/",
    errorClass: ErrorException = new ErrorException(ErrorCode.NotFound)
  ) {
    this.path = path;
    this.errorClass = errorClass;
  }
  public response_obj() {
    return {
      type: "object",
      properties: {
        response: { type: "string", example: "error" },
        error: {
          type: "object",
          properties: {
            type: {
              type: "string",
              example: this.errorClass.name,
            },
            path: {
              type: "string",
              example: this.path,
            },
            statusCode: {
              type: "integer",
              example: this.errorClass.status,
            },
            message: {
              type: "string",
              example: this.errorClass.message,
            },
          },
          additionalProperties: false,
        },
      },
    };
  }
}


// const err = new ErrorSchemaSwg(
//   "/users/register/",
//   new ErrorException(ErrorCode.InvalidInput)
// ).response_obj();
// console.log(err);
export { ErrorCode, ErrorException };
