import { FIXED_CHARGE_MONTHS } from "../modules/operationsFixes/services/fixedChargeAmounts";

export const fixedChargeDtoSchema = {
  type: "object",
  required: [
    "idOperationFixe",
    "titre",
    "montant",
    "devise",
    "periodicite",
    "pourcentagePersonnel",
    "montantPersonnel",
    "montantMensuelPersonnel",
  ],
  additionalProperties: false,
  properties: {
    idOperationFixe: { type: "integer", minimum: 1 },
    titre: { type: "string" },
    montant: {
      oneOf: [
        { type: "string", example: "120.00" },
        { type: "number", example: 120 },
      ],
    },
    devise: { type: "string", nullable: true, example: "EUR" },
    typeOperation: { type: "string", enum: ["CHARGE"] },
    periodicite: {
      type: "string",
      enum: Object.keys(FIXED_CHARGE_MONTHS),
      example: "ANNUELLE",
    },
    pourcentagePersonnel: {
      type: "number",
      minimum: 0,
      maximum: 100,
      multipleOf: 0.01,
      example: 50,
    },
    montantPersonnel: {
      type: "string",
      example: "60.00",
      description: "Personal amount per invoice, rounded half up to cents.",
    },
    montantMensuelPersonnel: {
      type: "string",
      example: "5.00",
      description:
        "Personal monthly budget cost, rounded once from the original invoice and share.",
    },
  },
};

export const fixedChargeResultResponse = (array = false) => ({
  description:
    "Fixed charge with invoice total, periodicity and personal amounts; no owner identifier.",
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean" },
          message: { type: "string" },
          data: array
            ? {
                type: "array",
                items: { $ref: "#/components/schemas/FixedCharge" },
              }
            : { $ref: "#/components/schemas/FixedCharge" },
        },
      },
    },
  },
});
