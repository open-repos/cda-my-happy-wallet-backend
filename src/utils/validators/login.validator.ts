import Joi from "joi"


export type loginUserProps = {
    email: string,
    password: string
}

export const loginSchema = Joi.object<loginUserProps>({
    email: Joi.string().email().lowercase().trim(true).required(),
    password: Joi.string().min(8).trim(true).required()
});