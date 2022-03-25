// import { schema_register_swagger } from './../../../../utils/validators/register.validator';

import { ResultCode } from './../../../../utils/results/resultCode';
import { Result } from './../../../../utils/results/resultList';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { CreateUser } from './createUser'
import { CreateUserController } from './createUserController'
import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'

// swagger info
export const swCreateUser = {
    "summary": "Register on application by given some personal infos",
    "tags": [
      "users"
    ],
    "requestBody": {
        "content": {
          "application/json": {
            "schema":{
                $ref:"#/components/schemas/Users"
            } 
          }
        }
      },
      "responses": {
        "200": {
          "description": new Result(ResultCode.Created).message
        },
        "default": {
          "description": "Error message"
        }
      }
    }
//Je construit mon repo avec les entités dont j'ai besoin
const userRepo = new UserRepo(prisma)
const createUser = new CreateUser(userRepo)
const createUserController = new CreateUserController(createUser)

export { createUser, createUserController }