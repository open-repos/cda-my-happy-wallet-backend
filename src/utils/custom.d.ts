declare namespace Express {
    export interface Request {
      user?: {
        id: number
      }
      shoulRunMiddleware2?:boolean
    }
    // export interface ErrorRequestHandler{
    //   message?: any,
    //   status?: any
    // }
  }
