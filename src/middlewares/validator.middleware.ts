import { ErrorException } from '../utils/errors/errorException.error';
import { ErrorCode } from '../utils/errors/errorCode.error';
import { NextFunction, Request, Response } from 'express';
// import * as Validators from "../utils/validators/index"
const Validators = require('../utils/validators/index')

export const Validator= (validator:any) => {
    // console.log("INSIDE MIDDLEWARE VALIDATOR")
    if(!Validators.hasOwnProperty(validator))
        throw new Error(`'${validator}' validator is not exist`)

    return async function(req:Request, _:Response, next:NextFunction) {
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
            next(new ErrorException(ErrorCode.IncompleteRequestBody,`Validators error: ${err.details[0].message}`))
            }
            next(err)
        }
    }

}