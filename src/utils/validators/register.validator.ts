import Joi from "joi"

export type createUserProps = {
    email: string;
    password: string;
    firstname: string;
    lastname: string;
  };
export const registerSchema = Joi.object<createUserProps>({
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(5).required(),
    firstname: Joi.string().min(1).required(),
    lastname: Joi.string().min(1).required()
});