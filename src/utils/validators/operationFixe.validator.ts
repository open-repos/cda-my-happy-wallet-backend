import Joi from "joi";
import j2s from "joi-to-swagger";
import {
  FIXED_CHARGE_MONTHS,
  FixedChargePeriodicity,
} from "../../modules/operationsFixes/services/fixedChargeAmounts";
export interface OperationFixeProps {
  titre: string;
  montant: number;
  devise: string;
  periodicite?: FixedChargePeriodicity;
  pourcentagePersonnel?: number;
}

export const operationFixeSchema = Joi.object<OperationFixeProps>({
  titre: Joi.string().min(2).max(50).trim(true).required().example("Loyer"),
  montant: Joi.number().min(1).required().example(600),
  devise: Joi.string().min(3).max(3).trim(true).required().example("EUR"),
  periodicite: Joi.forbidden(),
  pourcentagePersonnel: Joi.forbidden(),
});

const twoDecimals = (value: number, helpers: Joi.CustomHelpers) =>
  /^\d+(?:\.\d{1,2})?$/.test(String(value))
    ? value
    : helpers.error("number.precision", { limit: 2 });

export const chargeSchema = Joi.object<OperationFixeProps>({
  titre: Joi.string().min(2).max(50).trim(true).required().example("Loyer"),
  montant: Joi.number()
    .min(0.01)
    .max(99999999.99)
    .custom(twoDecimals)
    .required()
    .example(600),
  devise: Joi.string().min(3).max(3).trim(true).required().example("EUR"),
  periodicite: Joi.string()
    .valid(...Object.keys(FIXED_CHARGE_MONTHS))
    .example("ANNUELLE"),
  pourcentagePersonnel: Joi.number()
    .min(0)
    .max(100)
    .custom(twoDecimals)
    .example(50),
});

const revenuSchema = Joi.object<OperationFixeProps>({
  titre: Joi.string()
    .min(2)
    .max(50)
    .trim(true)
    .required()
    .example("Aide parents"),
  montant: Joi.number().min(1).required().example(300),
  devise: Joi.string().min(3).max(3).trim(true).required().example("EUR"),
});

export const revenuSchemaSwg = j2s(revenuSchema).swagger;
export const chargeSchemaSwg = j2s(chargeSchema).swagger;
