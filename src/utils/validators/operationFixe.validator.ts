import Joi from "joi"
import j2s from "joi-to-swagger"
export interface OperationFixeProps{
    titre: string;
    montant: number;
    devise: string;
  };

export const operationFixeSchema= Joi.object<OperationFixeProps> ({
    titre: Joi.string().min(2).max(50).trim(true).required().example("Loyer"),
    montant: Joi.number().min(1).required().example(600),
    devise: Joi.string().min(3).max(3).trim(true).required().example("EUR"),
});

const chargeSchema= Joi.object<OperationFixeProps> ({
  titre: Joi.string().min(2).max(50).trim(true).required().example("Loyer"),
  montant: Joi.number().min(1).required().example(600),
  devise: Joi.string().min(3).max(3).trim(true).required().example("EUR"),
});

const revenuSchema= Joi.object<OperationFixeProps> ({
  titre: Joi.string().min(2).max(50).trim(true).required().example("Aide parents"),
  montant: Joi.number().min(1).required().example(300),
  devise: Joi.string().min(3).max(3).trim(true).required().example("EUR"),
});


export const revenuSchemaSwg = j2s(revenuSchema).swagger
export const chargeSchemaSwg = j2s(chargeSchema).swagger


