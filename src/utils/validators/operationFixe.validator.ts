import Joi from "joi"

export const operationFixeSchema = Joi.object({
    titre: Joi.string().min(2).max(50).required(),
    montant: Joi.number().min(1).required(),
    devise: Joi.string().min(3).max(3).required(),
});