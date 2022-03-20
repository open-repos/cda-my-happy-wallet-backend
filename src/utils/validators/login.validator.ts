import Joi from "joi"


export type loginUserProps = {
    email: string,
    password: string
}

export const loginSchema = Joi.object<loginUserProps>({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(5).required()
});