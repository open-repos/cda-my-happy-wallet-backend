declare namespace Express {
    export interface Request {
      user? : any
      shoulRunMiddleware2?:boolean
    }
    // export interface ErrorRequestHandler{
    //   message?: any,
    //   status?: any
    // }
  }