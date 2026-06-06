import { Request, Response, NextFunction } from 'express';
import { ErrorException,ErrorCode } from '../utils/errors';
import { normalizePrismaError } from '../utils/errors/prismaError.error';
// import { ErrorModel } from '../utils/errors/errorModel.error';

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  const normalizedError = normalizePrismaError(err);
  // console.log('Error handling middleware called.');
  // console.log('Path:', req.path);
  // console.error('Error occured:', err);
  if (normalizedError instanceof ErrorException) {
    console.log('Error is known.');
    let objError={
            "response": "error",
              "error": {
                "type":normalizedError.name,
                "path": req.path,
                "statusCode": normalizedError.status,
                "message": normalizedError.message
              }
        
    }
    // res.status(err.status).json(err);
    res.status(normalizedError.status).json(objError);
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
  next(normalizedError)
};
