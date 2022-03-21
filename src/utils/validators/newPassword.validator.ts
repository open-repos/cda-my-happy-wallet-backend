import Joi from "joi"


export type newPasswordUserProps = {
    password: string,
    confirmPassword:string
}

export const newPasswordSchema = Joi.object<newPasswordUserProps>({
   password: Joi.string().min(8).trim(true).required(),
   confirmPassword:Joi.string().trim(true).required().valid(Joi.ref('password')),
});