import Joi from "joi"
import j2s from "joi-to-swagger"
export type createUserProps = {
    email: string;
    password: string;
    firstname: string;
    lastname: string;
  };
export const registerSchema = Joi.object<createUserProps>({
    email: Joi.string().email().lowercase().trim(true).required(),
    password: Joi.string().min(8).trim(true).required(),
    firstname: Joi.string().min(1).trim(true).required(),
    lastname: Joi.string().min(1).trim(true).required()
});



export const schema_register_swagger = j2s(registerSchema).swagger
console.log(schema_register_swagger, j2s(registerSchema).components)
