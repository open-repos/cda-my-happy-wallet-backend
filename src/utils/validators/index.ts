import Joi from "joi"
import { operationFixeSchema,OperationFixeProps } from './operationFixe.validator';
import { loginSchema, loginUserProps } from './login.validator';
import { registerSchema,createUserProps } from './register.validator';
import { renewRefreshTokenSchema,renewRefreshTokenProps } from "./renewRefreshToken.validator";


export interface ISchema {
    register:Joi.ObjectSchema<createUserProps>,
    login:Joi.ObjectSchema<loginUserProps>,
    operationFixe:Joi.ObjectSchema<OperationFixeProps>;
    renewRefreshToken:Joi.ObjectSchema<renewRefreshTokenProps>
}

export const Schemas:ISchema = {
    register: registerSchema,
    login:loginSchema,
    operationFixe:operationFixeSchema,
    renewRefreshToken:renewRefreshTokenSchema
}
