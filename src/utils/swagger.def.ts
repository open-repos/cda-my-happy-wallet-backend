import { schema_register_swagger } from './validators/register.validator';
import {PORT, APP_BASE_URL} from '../config/config'
import { swUserRouter } from '../routes/user';
const swagger = {
    openapi: '3.0.0',
    info: {
      title: 'MyHappyWallet API',
      version: '1.0.0',
      description: 'The REST API MyHappyWallet'
    },
    basePath: APP_BASE_URL,
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server'
      },
    ],
    tags:[
        {
            name:"OperationsFixe"
        }
    ],
    paths: {
        ...swUserRouter
    },
    components:{
        schemas:{
            Users:{
                $ref:schema_register_swagger
            }
        }
    }
  }
  export default swagger