import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '../utils/errors/errorCode.error';
import { ErrorException } from '../utils/errors/errorException.error';
// import { ErrorModel } from '../utils/errors/errorModel.error';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  // console.log('Error handling middleware called.');
  // console.log('Path:', req.path);
  // console.error('Error occured:', err);
  if (err instanceof ErrorException) {
    console.log('Error is known.');
    let objError={
            "response": "error",
              "error": {
                "type":err.name,
                "path": req.path,
                "statusCode": err.status,
                "message": err.message
              }
        
    }
    // res.status(err.status).json(err);
    res.status(err.status).json(objError);
  } else {
    // For unhandled errors.
    let objError={
        "response": "error",
          "error": {
            "type": ErrorCode.UnknownError,
            "path": req.path,
            "statusCode": 500,
            "message": "Unknown Error"
          }
    
}
    // res.status(500).json({ name: ErrorCode.UnknownError, status: 500 } as ErrorModel);
    res.status(500).json(objError)
  }
  next(err)
};