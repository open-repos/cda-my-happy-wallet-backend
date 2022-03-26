import Joi from "joi"
import { operationFixeSchema,OperationFixeProps } from './operationFixe.validator';
import { loginSchema, loginUserProps, loginSchemaSwg } from './login.validator';
import { registerSchema,createUserProps, registerSchemaSwg } from './register.validator';
import { renewRefreshTokenSchema,renewRefreshTokenProps } from "./renewRefreshToken.validator";
import { emailSchema, emailUserProps, emailSchemaSwg } from './email.validator';
import { newPasswordSchema, newPasswordUserProps, newPasswordSchemaSwg } from './newPassword.validator';
import { SwaggerSchema } from "joi-to-swagger";

// Validation Schema pour middleware Validator 'joi'
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

// Schema pour Swagger (joi-to-swagger)
interface ISchemaSwg{
    register:SwaggerSchema
    login:SwaggerSchema
    email:SwaggerSchema
    newpassword:SwaggerSchema
}

export const SchemaSwg:ISchemaSwg={
    register: registerSchemaSwg,
    login:loginSchemaSwg,
    email:emailSchemaSwg,
    newpassword:newPasswordSchemaSwg
}
