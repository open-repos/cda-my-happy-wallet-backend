
import { OperationFixe } from '@prisma/client';
import j2s from 'joi-to-swagger';
import Joi from "joi"


type resultOperationFixeProps = {
    success: string;
    message:string;
    data: OperationFixe;
  };
  
  const chargeSchema= Joi.object<OperationFixe> ({
    idOperationFixe:Joi.number().example(1),
    titre: Joi.string().min(2).max(50).trim(true).example("Loyer"),
    montant: Joi.number().min(1).example(600),
    devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
    typeOperation: Joi.string().valid("CHARGE").example("CHARGE"),
    userId:Joi.number().example(1),
    created_at:Joi.date().example(new Date()),
    updated_at:Joi.date().example(new Date()),
  });
  const revenuSchema= Joi.object<OperationFixe> ({
    idOperationFixe:Joi.number().example(2),
    titre: Joi.string().min(2).max(50).trim(true).example("Aide Parents"),
    montant: Joi.number().min(1).example(300),
    devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
    typeOperation: Joi.string().valid("REVENU").example("REVENU"),
    userId:Joi.number().example(1),
    created_at:Joi.date().example(new Date()),
    updated_at:Joi.date().example(new Date()),
  });

const resultCharge = Joi.object<resultOperationFixeProps>({
    success: Joi.boolean().example(true),
    message: Joi.string().example("Request successfully completed"),
    data: chargeSchema,
  });

  const resultRevenu = Joi.object<resultOperationFixeProps>({
    success: Joi.boolean().example(true),
    message: Joi.string().example("Request successfully completed"),
    data: revenuSchema,
  });



export const ChargeSchemaSwg = j2s(resultCharge).swagger
export const RevenuSchemaSwg = j2s(resultRevenu).swagger
