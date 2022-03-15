// import suelement de la fonction depuis le fichier server.ts
// import possible car on a "export" la fonction
import {createServer} from "./server"
import {PORT} from "./config"
import { prisma } from "./database/index"

var morgan = require('morgan')



const main = async () => {
    const server = await createServer();

    if (process.env.NODE_ENV === 'development') {
        server.use(morgan('dev'));
      }

    
    const users = await prisma.utilisateur.findMany();
    console.log("users",users);

    server.listen(PORT, () => {
        console.log(`Server is now running on port ${PORT}`)
    })
}

// FONCTION DE BASE OU ON CREE NOTRE SERVER , ON TETS AVEC NOTRE ORM ET UN PORT POUR ECOUTER
main();