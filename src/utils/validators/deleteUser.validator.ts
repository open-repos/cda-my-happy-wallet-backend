import j2s  from 'joi-to-swagger';
import Joi from "joi"


export type deleteEmailProps = {
    email: string,
    id:number,
}

export const deleteEmailSchema = Joi.object<deleteEmailProps>({
    email: Joi.string().email().lowercase().trim(true).required().example("thibault@example.com"),
    id:Joi.number().required()
});
// const emailStringSchema = Joi.string().email().lowercase().trim(true).required().example("thibault@example.com")
// export const emailStringSchemaSwg = j2s(emailStringSchema).swagger
export const deleteEmailSchemaSwg = j2s(deleteEmailSchema).swagger