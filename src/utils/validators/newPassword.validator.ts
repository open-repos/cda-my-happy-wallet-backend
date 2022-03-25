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