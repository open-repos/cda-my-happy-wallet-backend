const cents = { type: "integer", minimum: 0, maximum: 9999999999 };
const signedCents = { type: "integer" };
const allocations = {
  type: "array",
  maxItems: 100,
  items: {
    type: "object",
    additionalProperties: false,
    required: ["accountId", "amountMinorUnits"],
    properties: {
      accountId: { type: "integer", minimum: 1 },
      amountMinorUnits: { ...cents, minimum: 1 },
    },
  },
};
const plan = {
  savings: allocations,
  coverage: allocations,
  exceptionalIncomeMinorUnits: cents,
};
const ref = { $ref: "#/components/schemas/MonthEndDecision" };
export const monthEndSchemas = {
  MonthEndDecisionInput: {
    type: "object",
    additionalProperties: false,
    required: [
      "expectedRevision",
      "idempotencyKey",
      "savings",
      "coverage",
      "exceptionalIncomeMinorUnits",
    ],
    properties: {
      ...plan,
      expectedRevision: { type: "integer", minimum: 0, maximum: 2147483646 },
      idempotencyKey: { type: "string", pattern: "^[A-Za-z0-9:_-]{8,100}$" },
    },
  },
  MonthEndDecision: {
    type: "object",
    required: [
      "month",
      "currency",
      "status",
      "revision",
      ...Object.keys(plan),
      "savingsMinorUnits",
      "coverageMinorUnits",
      "resultBeforeDecisionMinorUnits",
      "referenceResultMinorUnits",
      "carryMinorUnits",
      "requiresReview",
      "correctionDeltaMinorUnits",
    ],
    properties: {
      ...plan,
      month: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      status: { type: "string", enum: ["PENDING", "DECIDED"] },
      revision: { type: "integer", minimum: 0 },
      savingsMinorUnits: cents,
      coverageMinorUnits: cents,
      resultBeforeDecisionMinorUnits: signedCents,
      referenceResultMinorUnits: signedCents,
      carryMinorUnits: signedCents,
      requiresReview: { type: "boolean" },
      correctionDeltaMinorUnits: signedCents,
    },
  },
};
const operation = {
  tags: ["ResteAVivre"],
  security: [{ accessToken_auth: [] }],
  parameters: [
    {
      name: "month",
      in: "path",
      required: true,
      schema: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
    },
    {
      name: "currency",
      in: "query",
      schema: { type: "string", pattern: "^[A-Za-z]{3}$", default: "EUR" },
    },
  ],
  responses: {
    "200": {
      description: "Decision and current carry, in integer cents",
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["data"],
            properties: { data: ref },
          },
        },
      },
    },
    "401": { description: "Authentication required" },
    "404": {
      description: "An allocation account does not belong to the owner",
    },
    "409": {
      description:
        "PERIOD_NOT_CLOSED, REVISION_CONFLICT, IDEMPOTENCY_CONFLICT, ACCOUNT_ARCHIVED, CURRENCY_MISMATCH, INSUFFICIENT_SAVINGS or BALANCE_LIMIT",
    },
    "422": {
      description:
        "INVALID_MONTH, INVALID_CURRENCY, INVALID_DECISION, INVALID_ALLOCATION or ALLOCATION_EXCEEDS_RESULT; stable code in error.details.code",
    },
  },
};
export const swMonthEndRouter = {
  "/budget-periods/{month}/decision": {
    get: {
      ...operation,
      summary: "Read a closed month's allocation or pending full carry",
      description:
        "Available from the next month's first civil day in Europe/Paris. A pending decision carries the entire balance. May materialize a closed budget period.",
    },
    put: {
      ...operation,
      summary: "Replace a closed month's allocation atomically",
      description:
        "carry = resultBeforeDecision - savings + coverage + exceptional income. Result includes incoming carry. expectedRevision=0 creates the first decision. Same owner/key and normalized request replay the original receipt; a changed payload conflicts. Revisions append compensation transfers. See docs/month-end-decisions.md; owner formula review is required before merge.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/MonthEndDecisionInput" },
          },
        },
      },
    },
  },
};
