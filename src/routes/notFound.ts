import { ErrorCode } from './../utils/errors/errorCode.error';
import { ErrorException } from './../utils/errors/errorException.error';
import { Router, Request, Response, NextFunction } from 'express';

const notFoundRouter: Router = Router();


notFoundRouter.use((_:Request, _r:Response, next:NextFunction) => {
    // res.status(404).send('<h1>Page not found</h1>')
    return next(new ErrorException(ErrorCode.NotFound))
})


export  {notFoundRouter}