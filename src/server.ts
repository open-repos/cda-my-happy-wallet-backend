import express from 'express'
import cors from 'cors'
// import morgan from 'morgan'
import bodyParser from 'body-parser'

import {mainRouter} from './router'

import { APP_BASE_URL } from './config';
import { notFoundRouter } from './routes/notFound';

export const createServer = async () => {
    //Initialization de notre server Express
    const server: express.Application = express();

    server.use(bodyParser.urlencoded({ extended: true }))
    server.use(bodyParser.json())
    // use correspond à un middleware 
    //Notre serveur parsera les requête entrante en Json
    // server.use(express.json()) 

    //On indique les cors (qui peut emettre des call depuis notre API)
    server.use(cors({
        origin:["http://localhost:1234","https://myhappywallet.andriacapai.com"]
    }))

    //On rajoute le router à notre server
    //Il sera accessible sur la route APP_BASE_URL, ici -> /v1/
    server.use(APP_BASE_URL, mainRouter)

    // Gestion des routes non trouvées
    // server.use((_,res) => {
    //     res.status(404).send('<h1>Page not found</h1>')
    // })
    server.use(notFoundRouter)

    return server
}