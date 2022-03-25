import { errorSchemaSwg } from './errors/index';
import { ErrorCode } from './errors/errorCode.error';
import { ErrorException } from './errors/errorException.error';
import { SchemaSwg } from './validators/index';
import {PORT, APP_BASE_URL} from '../config/config'
import { swUserRouter } from '../routes/user';
import { ErrorSchemaSwg } from './errors';


// async function main() {
//   var value = await Promise.resolve(new ErrorSchemaSwg("/users/register/",new ErrorException(ErrorCode.Unauthorized)).response_obj())
//   console.log('inside: ' + value);
//   return value;
// }

var text = new ErrorSchemaSwg("/users/register/",new ErrorException(ErrorCode.Unauthorized)).response_obj()
console.log('outside: ' + text)


const swagger  =  {
    openapi: '3.0.0',
    info: {
      title: 'MyHappyWallet API',
      version: '1.0.0',
      description: 'The REST API MyHappyWallet'
    },
    basePath: APP_BASE_URL,
    servers: [
      {
        url: `http://localhost:${PORT}${APP_BASE_URL}`,
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
            Register:SchemaSwg.register,
            ErrorResponse: errorSchemaSwg
            }
    }
  }
  export default swagger