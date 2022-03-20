// import { ErrorException } from '../utils/errors/errorException.error';
// import { ErrorCode } from '../utils/errors/errorCode.error';
import { NextFunction, Request, Response } from 'express';
// import * as Validators from "../utils/validators/index"
const Validators = require('../utils/validators/index')

export const Validator= (validator:any) => {
    // console.log("INSIDE MIDDLEWARE VALIDATOR")
    if(!Validators.hasOwnProperty(validator))
        throw new Error(`'${validator}' validator is not exist`)

    return async function(req:Request, res:Response, next:NextFunction) {
        console.log("INSIDE MIDDLEWARE VALIDATOR")
        try {
            const validated = await Validators[validator].validateAsync(req.body)
            req.body = validated
            next()
        } catch (err) {
            // Pass err to next
            // If validation error occurs call next with HTTP 422. Otherwise HTTP 500
            if(err.isJoi) {
                console.log("ERROR JOI",err)
                // console.log("ERROR",error)
                let objError={
                    "response": "error",
                      "error": {
                        "type":err.name,
                        "path": req.path,
                        "statusCode": 400,
                        "message": err.details[0].message
                      }
                
                }
            // res.status(err.status).json(err);
            res.status(400).json(objError);
            // throw new ErrorException(ErrorCode.IncompleteRequestBody,`Validators error: ${err.details[0].message}`)
                // throw new ErrorException(ErrorCode.IncompleteRequestBody,"Validators Error")
            }
            // next(err)
            // throw new ErrorException(ErrorCode.IncompleteRequestBody,`Validators error: ${err.details[0].message}`)
        }
        // next(error)
    }

}