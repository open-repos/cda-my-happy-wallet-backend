
import { OperationFixe } from '@prisma/client';
import j2s from 'joi-to-swagger';
import Joi from "joi"


type resultOperationFixeProps = {
    success: string;
    message:string;
    data: OperationFixe;
  };
  
  const OperationFixeSchema= Joi.object<OperationFixe> ({
    idOperationFixe:Joi.number().example(1),
    titre: Joi.string().min(2).max(50).trim(true).example("Loyer"),
    montant: Joi.number().min(1).example(600),
    devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
    typeOperation: Joi.string().valid("CHARGE","REVENU").example("CHARGE"),
    userId:Joi.number().example(1),
    created_at:Joi.date().example(new Date()),
    updated_at:Joi.date().example(new Date()),
  });
  const arrayOperationFixeSchema= Joi.array().items({
    idOperationFixe:Joi.number().example(1),
    titre: Joi.string().min(2).max(50).trim(true).example("Loyer"),
    montant: Joi.number().min(1).example(600),
    devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
    typeOperation: Joi.string().valid("CHARGE","REVENU").example("CHARGE"),
    userId:Joi.number().example(1),
    created_at:Joi.date().example(new Date()),
    updated_at:Joi.date().example(new Date()),
  },{
    idOperationFixe:Joi.number().example(2),
    titre: Joi.string().min(2).max(50).trim(true).example("Aide parents"),
    montant: Joi.number().min(1).example(200),
    devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
    typeOperation: Joi.string().valid("CHARGE","REVENU").example("REVENU"),
    userId:Joi.number().example(1),
    created_at:Joi.date().example(new Date()),
    updated_at:Joi.date().example(new Date()),});



    const arrayChargeFixeSchema= Joi.array().items({
        idOperationFixe:Joi.number().example(1),
        titre: Joi.string().min(2).max(50).trim(true).example("Loyer"),
        montant: Joi.number().min(1).example(600),
        devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
        typeOperation: Joi.string().valid("CHARGE").example("CHARGE"),
        userId:Joi.number().example(1),
        created_at:Joi.date().example(new Date()),
        updated_at:Joi.date().example(new Date()),
      },{
        idOperationFixe:Joi.number().example(3),
        titre: Joi.string().min(2).max(50).trim(true).example("Abonnement Canal"),
        montant: Joi.number().min(1).example(20),
        devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
        typeOperation: Joi.string().valid("CHARGE").example("CHARGE"),
        userId:Joi.number().example(1),
        created_at:Joi.date().example(new Date()),
        updated_at:Joi.date().example(new Date()),});

        const arrayRevenuFixeSchema= Joi.array().items({
            idOperationFixe:Joi.number().example(2),
            titre: Joi.string().min(2).max(50).trim(true).example("Aide Parents"),
            montant: Joi.number().min(1).example(300),
            devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
            typeOperation: Joi.string().valid("REVENU").example("REVENU"),
            userId:Joi.number().example(1),
            created_at:Joi.date().example(new Date()),
            updated_at:Joi.date().example(new Date()),
          },{
            idOperationFixe:Joi.number().example(4),
            titre: Joi.string().min(2).max(50).trim(true).example("Aide Crous"),
            montant: Joi.number().min(1).example(200),
            devise: Joi.string().min(3).max(3).trim(true).example("EUR"),
            typeOperation: Joi.string().valid("REVENU").example("REVENU"),
            userId:Joi.number().example(1),
            created_at:Joi.date().example(new Date()),
            updated_at:Joi.date().example(new Date()),});

const resultOperationFixe = Joi.object<resultOperationFixeProps>({
  success: Joi.boolean().example(true),
  message: Joi.string().example("Request successfully completed"),
  data: arrayOperationFixeSchema,
});

const resultCharge = Joi.object<resultOperationFixeProps>({
    success: Joi.boolean().example(true),
    message: Joi.string().example("Request successfully completed"),
    data: arrayChargeFixeSchema,
  });

  const resultRevenu = Joi.object<resultOperationFixeProps>({
    success: Joi.boolean().example(true),
    message: Joi.string().example("Request successfully completed"),
    data: arrayRevenuFixeSchema,
  });


export const OperationFixeSchemaSwg = j2s(OperationFixeSchema).swagger
export const ListOperationFixeSchemaSwg = j2s(resultOperationFixe).swagger
export const ListChargeSchemaSwg = j2s(resultCharge).swagger
export const ListRevenuSchemaSwg = j2s(resultRevenu).swagger
