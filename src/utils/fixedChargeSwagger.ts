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
    "categoryId",
    "category",
  ],
  additionalProperties: false,
  properties: {
    isBudgetEnvelope: {
      type: "boolean",
      default: false,
      description:
        "Explicit opt-in for monthly expense reconciliation. Ordinary charges and income are never payment targets.",
    },
    categoryId: { type: "integer", minimum: 1, nullable: true },
    category: {
      type: "object",
      nullable: true,
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
        color: { type: "string", nullable: true },
        icon: { type: "string", nullable: true },
        fixedKind: {
          type: "string",
          enum: ["CHARGE", "REVENU"],
          nullable: true,
        },
      },
    },
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

export const fixedIncomeDtoSchema = {
  type: "object",
  required: [
    "idOperationFixe",
    "titre",
    "montant",
    "devise",
    "categoryId",
    "category",
  ],
  properties: {
    idOperationFixe: fixedChargeDtoSchema.properties.idOperationFixe,
    titre: fixedChargeDtoSchema.properties.titre,
    montant: fixedChargeDtoSchema.properties.montant,
    devise: fixedChargeDtoSchema.properties.devise,
    typeOperation: { type: "string", enum: ["REVENU"] },
    categoryId: fixedChargeDtoSchema.properties.categoryId,
    category: fixedChargeDtoSchema.properties.category,
  },
};

export const fixedChargeResultResponse = (
  array = false,
  schema = "FixedCharge"
) => ({
  description:
    "Fixed operation with optional personal category; charge amounts include periodicity and personal share. No owner identifier.",
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
                items: { $ref: `#/components/schemas/${schema}` },
              }
            : { $ref: `#/components/schemas/${schema}` },
        },
      },
    },
  },
});
