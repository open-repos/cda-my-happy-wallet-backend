
import express from 'express'
//import { Request, Response, NextFunction ,ErrorRequestHandler} from 'express'
import cors from 'cors'
// import morgan from 'morgan'
import bodyParser from 'body-parser'
import cookieParser from "cookie-parser"
import {mainRouter} from './router'
import { APP_BASE_URL,NODE_ENV } from './config/config';
import { notFoundRouter } from './routes/notFound';
import morgan from 'morgan'
export const createServer = async () => {
    //Initialization de notre server Express
    const server: express.Application = express();

    server.use(bodyParser.urlencoded({ extended: true }))
    server.use(bodyParser.json())
    // use correspond à un middleware 
    //Notre serveur parsera les requête entrante en Json
    // server.use(express.json()) 
    server.use(cookieParser());
    //On indique les cors (qui peut emettre des call depuis notre API)
    server.use(cors({
        origin:["http://localhost:1234","https://myhappywallet.andriacapai.com"]
    }))

        
    if (NODE_ENV === 'development') {
        server.use(morgan('dev'));
      }
    //On rajoute le router à notre server
    //Il sera accessible sur la route APP_BASE_URL, ici -> /v1/
    server.use(APP_BASE_URL as string, mainRouter)

    // Gestion des routes non trouvées
    // server.use((_,res) => {
    //     res.status(404).send('<h1>Page not found</h1>')
    // })
    server.use(notFoundRouter)

    // server.use((error:ErrorRequestHandler,req:Request,res:Response,next:NextFunction)=>{
    //     res.status(error. || 500)
    //     res.json({
    //         error:{
    //             message: error.message
    //         }
    //     })
    // })

    return server
}