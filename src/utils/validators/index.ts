import Joi from "joi"
import { operationFixeSchema,OperationFixeProps } from './operationFixe.validator';
import { loginSchema, loginUserProps } from './login.validator';
import { registerSchema,createUserProps } from './register.validator';
import { renewRefreshTokenSchema,renewRefreshTokenProps } from "./renewRefreshToken.validator";
import { emailSchema,emailUserProps } from './email.validator';
import { newPasswordSchema,newPasswordUserProps } from './newPassword.validator';


export interface ISchema {
    register:Joi.ObjectSchema<createUserProps>,
    login:Joi.ObjectSchema<loginUserProps>,
    operationFixe:Joi.ObjectSchema<OperationFixeProps>;
    renewRefreshToken:Joi.ObjectSchema<renewRefreshTokenProps>
    emailUser:Joi.ObjectSchema<emailUserProps>
    newPassword:Joi.ObjectSchema<newPasswordUserProps>
}

export const Schemas:ISchema = {
    register: registerSchema,
    login:loginSchema,
    operationFixe:operationFixeSchema,
    renewRefreshToken:renewRefreshTokenSchema,
    emailUser:emailSchema,
    newPassword:newPasswordSchema,
}
