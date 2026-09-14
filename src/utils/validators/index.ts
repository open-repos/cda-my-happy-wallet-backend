import Joi from "joi"
import { operationFixeSchema, OperationFixeProps, chargeSchemaSwg, revenuSchemaSwg } from './operationFixe.validator';
import { loginSchema, loginUserProps, loginSchemaSwg } from './login.validator';
import { registerSchema,createUserProps, registerSchemaSwg } from './register.validator';
import { renewRefreshTokenSchema,renewRefreshTokenProps, renewAccessTokenSchemaSwg } from "./renewRefreshToken.validator";
import { emailSchema, emailUserProps, emailSchemaSwg } from './email.validator';
import { deleteEmailSchemaSwg,deleteEmailSchema,deleteEmailProps } from "./deleteUser.validator";
import { newPasswordSchema, newPasswordUserProps, newPasswordSchemaSwg } from './newPassword.validator';
import { SwaggerSchema } from "joi-to-swagger";
import {
    NativeRefreshSessionProps,
    nativeRefreshSessionSchema,
    nativeRefreshSessionSchemaSwg,
} from "./nativeRefreshSession.validator";

// Validation Schema pour middleware Validator 'joi'
export interface ISchema {
    register:Joi.ObjectSchema<createUserProps>,
    login:Joi.ObjectSchema<loginUserProps>,
    operationFixe:Joi.ObjectSchema<OperationFixeProps>;
    renewRefreshToken:Joi.ObjectSchema<renewRefreshTokenProps>
    emailUser:Joi.ObjectSchema<emailUserProps>
    newPassword:Joi.ObjectSchema<newPasswordUserProps>
    deleteEmail:Joi.ObjectSchema<deleteEmailProps>
    nativeRefreshSession:Joi.ObjectSchema<NativeRefreshSessionProps>
}

export const Schemas:ISchema = {
    register: registerSchema,
    login:loginSchema,
    operationFixe:operationFixeSchema,
    renewRefreshToken:renewRefreshTokenSchema,
    emailUser:emailSchema,
    newPassword:newPasswordSchema,
    deleteEmail:deleteEmailSchema,
    nativeRefreshSession:nativeRefreshSessionSchema
}

// Schema pour Swagger (joi-to-swagger)
interface ISchemaSwg{
    register:SwaggerSchema
    login:SwaggerSchema
    email:SwaggerSchema
    newpassword:SwaggerSchema
    renewAccessToken:SwaggerSchema
    charge:SwaggerSchema
    revenu:SwaggerSchema
    deleteEmail:SwaggerSchema
    nativeRefreshSession:SwaggerSchema
}

export const SchemaSwg:ISchemaSwg={
    register: registerSchemaSwg,
    login:loginSchemaSwg,
    email:emailSchemaSwg,
    newpassword:newPasswordSchemaSwg,
    renewAccessToken:renewAccessTokenSchemaSwg,
    charge:chargeSchemaSwg,
    revenu:revenuSchemaSwg,
    deleteEmail:deleteEmailSchemaSwg,
    nativeRefreshSession:nativeRefreshSessionSchemaSwg
}
