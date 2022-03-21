import Joi from "joi"


export type emailUserProps = {
    email: string,
}

export const emailSchema = Joi.object<emailUserProps>({
    email: Joi.string().email().lowercase().trim(true).required(),
});