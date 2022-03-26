import { nestedStrongPassword } from './register.validator';
import Joi from "joi"
import j2s from "joi-to-swagger"

export type loginUserProps = {
    email: string,
    password: string
}

export const loginSchema = Joi.object<loginUserProps>({
    email: Joi.string().email().lowercase().trim(true).required().example("thibault@example.com"),
    password: nestedStrongPassword
});

export const loginSchemaSwg = j2s(loginSchema).swagger
// console.log(loginSchemaSwg, j2s(loginSchema).components)