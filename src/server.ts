import { errorLogging } from './middlewares/errorLogging.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';

import express, { Request, Response } from 'express'
//import { Request, Response, NextFunction ,ErrorRequestHandler} from 'express'
import cors from 'cors'
// import morgan from 'morgan'
import cookieParser from "cookie-parser"
import {mainRouter} from './router'
import { APP_BASE_URL,CORS_ORIGINS,NODE_ENV } from './config/config';
import { notFoundRouter } from './routes/notFound';
import morgan from 'morgan'
import swaggerUI from 'swagger-ui-express'
import swDocument from './utils/swagger.def'

export const createServer = async () => {
    //Initialization de notre server Express
    const server: express.Application = express();
    
    server.use(express.urlencoded({ extended: true }))
    server.use(express.json())
    server.use('/api-docs',swaggerUI.serve,swaggerUI.setup(swDocument))
    // use correspond à un middleware 
    //Notre serveur parsera les requête entrante en Json
    // server.use(express.json()) 
    server.use(cookieParser());
    //On indique les cors (qui peut emettre des call depuis notre API)
    // blocking cors errors:
  let origin:string | Array<string>=""
  // console.log(NODE_ENV)
  if (NODE_ENV=='production'){
    origin="https://myhappywallet.andriacapai.com"
  }
  if (NODE_ENV=='development'){
    origin=CORS_ORIGINS.length > 0
      ? CORS_ORIGINS
      : ["http://localhost:3000","http://localhost:5173","https://myhappywallet.andriacapai.com"]
  }
  
  const corsOptions = {
    origin: origin,
    credentials: true,           
    methods: ["OPTIONS,GET,HEAD,PUT,PATCH,POST,DELETE"],
    // "preflightContinue": true,
    optionSuccessStatus: 200,
  }
    server.use(cors(
      corsOptions
    ))


        
    if (NODE_ENV === 'development') {
        server.use(morgan('dev'));
      }
    server.get("/",(_: Request,res: Response) => {
      res.redirect('/api-docs');
  });
      
  // server.use(function(_:Request, res:Response, next) {
  //   res.header('Access-Control-Allow-Origin', "http://localhost:3000");
  //   res.header('Access-Control-Allow-Credentials', "true");
  //   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  //   next();
  // });
    //On rajoute le router à notre server
    //Il sera accessible sur la route APP_BASE_URL, ici -> /v1/
    server.use(APP_BASE_URL as string, mainRouter)

    server.use(notFoundRouter)
    
    server.use(errorHandler)

    if (NODE_ENV === 'development') {
        server.use(errorLogging);
      }


    return server
}
