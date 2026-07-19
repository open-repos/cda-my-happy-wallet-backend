import { ErrorException,ErrorCode }  from "../utils/errors/";
import { NextFunction, Request, Response } from "express";
import {ISchema, Schemas} from "../utils/validators/index"
// const Validators = require("../utils/validators/index");
// type T = keyof typeof Validators;
export const Validator = (validator: keyof ISchema) => {
  // console.log("INSIDE MIDDLEWARE VALIDATOR")
  if (!Schemas.hasOwnProperty(validator))
    throw new Error(`'${validator}' validator is not exist`);

  return async function (req: Request, _: Response, next: NextFunction) {
    const options = {
      abortEarly: false, // include all errors
      allowUnknown: true, // ignore unknown props
      stripUnknown: true, // remove unknown props
    };
    Schemas[validator]
      .validateAsync(req.body,options)
      .then((value: any) => {
        req.body = value;
        next();
      })
      .catch((error: any) =>
        next(
          new ErrorException(
            ErrorCode.IncompleteRequestBody,
            `Validators error: ${error.details
              .map((x: any) => x.message)
              .join(", ")}`,
            {
              fields: error.details.map((detail: any) => ({
                field: detail.path.join("."),
                message: detail.message,
                rule: detail.type,
              })),
            }
          )
        )
      );
    // try {
    // const { error, validated } = await Validators[validator].validateAsync(req.body)
    // req.body = validated
    // next()
    // } catch (err) {
    // Pass err to next
    // If validation error occurs call next with HTTP 422. Otherwise HTTP 500
    // if(err.isJoi) {
    // console.log("ERROR JOI",err)
    // next(new ErrorException(ErrorCode.IncompleteRequestBody,`Validators error: ${err.details[0].message}`))
    // }
    // next(err)
//   };
};
}

//  export const validateRequest = (schema:any) => {
//     return async (req:Request,next:NextFunction) => {
//     const options = {
//         abortEarly: false, // include all errors
//         allowUnknown: true, // ignore unknown props
//         stripUnknown: true // remove unknown props
//     };
//     const { error, value } = await schema.validateAsync(req.body, options);
//     if (error) {
//         // next(`Validation error: ${error.details.map((x:any) => x.message).join(', ')}`);
//         next(new ErrorException(ErrorCode.IncompleteRequestBody,`Validators error: ${error.details.map((x:any) => x.message).join(', ')}`))
//     } else {
//         req.body = value;
//         next();
//     }
//  }
// }
