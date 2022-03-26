import j2s  from 'joi-to-swagger';
import Joi from "joi"


export type emailUserProps = {
    email: string,
}

export const emailSchema = Joi.object<emailUserProps>({
    email: Joi.string().email().lowercase().trim(true).required().example("thibault@example.com"),
});
// const emailStringSchema = Joi.string().email().lowercase().trim(true).required().example("thibault@example.com")
// export const emailStringSchemaSwg = j2s(emailStringSchema).swagger
export const emailSchemaSwg = j2s(emailSchema).swagger