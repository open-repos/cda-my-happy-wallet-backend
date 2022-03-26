import { ResSchemaSwg } from './results/index';
import { errorSchemaSwg } from './errors/index';
import { SchemaSwg } from './validators/index';
import {PORT, APP_BASE_URL} from '../config/config'
import { swUserRouter } from '../routes/user';



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
      {
        url: `https://api.myhappywallet.andriacapai.com${APP_BASE_URL}`,
        description: 'Production server'
      },
    ],
    tags: [
      {
        "name": "Users",
        "description": "Everything about Users (login, register, resetPassword and so on)"
      },
      {
        "name": "OperationsFixe",
        "description": "Everything about Operation Fixe (incomes, charges each month)",
      },
      {
        "name": "Operations",
        "description": "All Request about Operations (expenses, incomes)",
      },
      {
        "name": "ResteAVivre",
        "description": "All Request about ResteAVivre (disposable income)",
      },
      {
        "name": "Evenements",
        "description": "All Request about Evenements (Future Events scheduled in order to budget)",
      },
      {
        "name": "Objectifs",
        "description": "All Request about Objectifs (Goals targeted and budget to reach it)",
      },
      {
        "name": "ResteAVivreFictif",
        "description": "All Request about ResteAVivreFictif (fictive disposable income according to events and goals)",
      },
    ],
    paths: {
        ...swUserRouter
    },
    components:{
        schemas:{
            Register:SchemaSwg.register,
            Login:SchemaSwg.login,
            ResetPassword:SchemaSwg.email,
            NewPassword: SchemaSwg.newpassword,
            ErrorResponse: errorSchemaSwg,
            SuccessResponse: ResSchemaSwg.success,
            AuthResponse: ResSchemaSwg.resAuth
            }
    }
  }
  export default swagger