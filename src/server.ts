import { errorLogging } from './middlewares/errorLogging.middleware';
import { errorHandler } from './middlewares/errorHandler.middleware';

import express, { Request, Response } from 'express'
//import { Request, Response, NextFunction ,ErrorRequestHandler} from 'express'
// import morgan from 'morgan'
import cookieParser from "cookie-parser"
import {mainRouter} from './router'
import { API_DOCS_ENABLED,APP_BASE_URL,NODE_ENV } from './config/config';
import { notFoundRouter } from './routes/notFound';
import morgan from 'morgan'
import swaggerUI from 'swagger-ui-express'
import swDocument from './utils/swagger.def'
import { prisma } from './database'
import { securityHeaders } from './middlewares/securityHeaders.middleware';
import {
  jsonBodyParser,
  urlEncodedBodyParser,
} from './middlewares/requestBody.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';

type ServerDependencies = {
  checkDatabase: () => Promise<void>;
  apiDocsEnabled?: boolean;
};

const defaultDependencies: ServerDependencies = {
  checkDatabase: async () => {
    await prisma.$queryRaw`SELECT 1`;
  },
};

export const createServer = async (
  dependencies: ServerDependencies = defaultDependencies
) => {
    //Initialization de notre server Express
    const server: express.Application = express();

    if (NODE_ENV === 'production') {
      server.set('trust proxy', 1);
    }

    server.use(securityHeaders);
    
    server.use(urlEncodedBodyParser)
    server.use(jsonBodyParser)
    server.get('/health/live', (_: Request, res: Response) => {
      res.set('Cache-Control', 'no-store').status(200).json({ status: 'ok' });
    });
    server.get('/health/ready', async (_: Request, res: Response) => {
      try {
        await dependencies.checkDatabase();
        res.set('Cache-Control', 'no-store').status(200).json({ status: 'ok' });
      } catch {
        res
          .set('Cache-Control', 'no-store')
          .status(503)
          .json({ status: 'unavailable' });
      }
    });
    const apiDocsEnabled = dependencies.apiDocsEnabled ?? API_DOCS_ENABLED;
    if (apiDocsEnabled) {
      server.use('/api-docs',swaggerUI.serve,swaggerUI.setup(swDocument))
    }
    // use correspond à un middleware 
    //Notre serveur parsera les requête entrante en Json
    // server.use(express.json()) 
    server.use(cookieParser());
    server.use(corsMiddleware)


        
    if (NODE_ENV === 'development') {
        server.use(morgan('dev'));
      }
    if (apiDocsEnabled) {
      server.get("/",(_: Request,res: Response) => {
        res.redirect('/api-docs');
      });
    }
      
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
