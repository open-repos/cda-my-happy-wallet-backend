import { schema_register_swagger } from './../../../../utils/validators/register.validator';
import { ResultCode } from './../../../../utils/results/resultCode';
import { Result } from './../../../../utils/results/resultList';
// Il va s'occuper d'instancier les classes pour la création d'user iciimport { UserRepo } from '../../userRepo'
import { ConfirmRegistrationUser } from './confirmRegistrationUser'
import { ConfirmRegistrationUserController } from './confirmRegistrationUserController'
import { prisma } from '../../../../database/index'
import { UserRepo } from '../../userRepo'


export const swConfirmRegistrationUser = {
    "summary": "Confirm Registration by clicking on email received",
    "tags": [
      "users"
    ],
    "requestParams": {
        "content": {
          "application/json": {
            "schema": {
                ...schema_register_swagger
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": new Result(ResultCode.Created,'','User successfully registered').message
        },
        "default": {
          "description": "Error message"
        }
      }
    }
//Je construit mon repo avec les entités dont j'ai besoin
const userRepo = new UserRepo(prisma)
const confirmRegistrationUser = new ConfirmRegistrationUser(userRepo)
const confirmRegistrationUserController = new ConfirmRegistrationUserController(confirmRegistrationUser)

export { confirmRegistrationUser, confirmRegistrationUserController }