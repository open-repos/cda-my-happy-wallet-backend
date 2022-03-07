import express from 'express'
import cors from 'cors'

import {mainRouter} from './router'

import { APP_BASE_URL } from './config';

export const createServer = async () => {
    //Initialization de notre server Express
    const server: express.Application = express();

    //Notre serveur parsera les requête entrante en Json
    server.use(express.json())

    //On indique les cors (qui peut emettre des call depuis notre API)
    server.use(cors({
        origin:"http://localhost:1234"
    }))

    //On rajoute le router à notre server
    //Il sera accessible sur la route APP_BASE_URL, ici -> /v1/
    server.use(APP_BASE_URL, mainRouter)

    return server
}