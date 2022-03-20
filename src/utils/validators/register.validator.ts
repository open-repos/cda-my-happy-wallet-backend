import Joi from "joi"

export const registerSchema = Joi.object({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(5).required(),
    firstname: Joi.string().min(1).required(),
    lastname: Joi.string().min(1).required()
});