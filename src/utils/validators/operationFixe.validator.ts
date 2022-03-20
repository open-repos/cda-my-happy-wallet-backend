import Joi from "joi"

export interface OperationFixeProps{
    titre: string;
    montant: number;
    devise: string;
  };
export const operationFixeSchema= Joi.object<OperationFixeProps> ({
    titre: Joi.string().min(2).max(50).required(),
    montant: Joi.number().min(1).required(),
    devise: Joi.string().min(3).max(3).required(),
});