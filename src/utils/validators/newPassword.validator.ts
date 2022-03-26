import j2s from 'joi-to-swagger';
import { nestedStrongPassword } from './register.validator';
import Joi from "joi"


export type newPasswordUserProps = {
    password: string,
    confirmPassword:string
}

export const newPasswordSchema = Joi.object<newPasswordUserProps>({
   password: nestedStrongPassword,
   confirmPassword:Joi.string().trim(true).required().valid(Joi.ref('password')),
});

export const newPasswordSchemaSwg = j2s(newPasswordSchema).swagger