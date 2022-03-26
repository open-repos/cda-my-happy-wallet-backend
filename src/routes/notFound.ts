import { ErrorException,ErrorCode } from './../utils/errors/';
import { Router, Request, Response, NextFunction } from 'express';

const notFoundRouter: Router = Router();


notFoundRouter.use((_:Request, _r:Response, next:NextFunction) => {
    return next(new ErrorException(ErrorCode.NotFound))
})


export  {notFoundRouter}