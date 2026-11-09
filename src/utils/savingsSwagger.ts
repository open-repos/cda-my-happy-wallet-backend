import {
  paginatedCollectionResponse,
  paginationParameters,
} from "./paginationSwagger";

const cents = { type: "integer", minimum: 0, maximum: 9999999999 };
const positiveCents = { ...cents, minimum: 1 };
const identifier = { type: "integer", minimum: 1 };
const text = { type: "string", minLength: 2, maxLength: 50 };
const currency = { type: "string", pattern: "^[A-Z]{3}$", example: "EUR" };
const month = {
  type: "string",
  pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$",
  example: "2026-11",
};
const civilDate = { type: "string", format: "date" };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const movementSchema = {
  type: "object",
  required: [
    "id",
    "accountId",
    "type",
    "currency",
    "direction",
    "reason",
    "amountMinorUnits",
    "operationDate",
    "idempotencyKey",
  ],
  properties: {
    id: identifier,
    accountId: identifier,
    type: { type: "string", enum: ["VIREMENT"] },
    currency,
    direction: { type: "string", enum: ["TO_SAVINGS", "FROM_SAVINGS"] },
    reason: {
      type: "string",
      enum: ["MANUAL", "MONTH_END", "NEGATIVE_COVERAGE", "GOAL"],
    },
    amountMinorUnits: positiveCents,
    operationDate: civilDate,
    idempotencyKey: { type: "string" },
    monthEndRevision: { type: "integer", minimum: 1 },
    isCompensation: {
      type: "boolean",
      description:
        "A linked month-end revision reverses an earlier allocation; reason retains its origin and direction is reversed.",
    },
  },
};

export const savingsSchemas = {
  SavingsAccountInput: {
    type: "object",
    additionalProperties: false,
    required: ["name", "currency"],
    properties: {
      name: text,
      currency,
      initialBalanceMinorUnits: { ...cents, default: 0 },
    },
  },
  SavingsAccountPatch: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: { name: text, archived: { type: "boolean", enum: [true] } },
  },
  SavingsAccount: {
    type: "object",
    additionalProperties: false,
    required: [
      "id",
      "name",
      "currency",
      "initialBalanceMinorUnits",
      "balanceMinorUnits",
      "archived",
      "goalId",
    ],
    properties: {
      id: identifier,
      name: text,
      currency,
      initialBalanceMinorUnits: cents,
      balanceMinorUnits: cents,
      archived: { type: "boolean" },
      goalId: { ...identifier, nullable: true },
    },
  },
  SavingsTransferInput: {
    type: "object",
    additionalProperties: false,
    required: [
      "direction",
      "amountMinorUnits",
      "operationDate",
      "idempotencyKey",
    ],
    properties: {
      direction: { type: "string", enum: ["TO_SAVINGS", "FROM_SAVINGS"] },
      amountMinorUnits: positiveCents,
      operationDate: civilDate,
      reason: {
        type: "string",
        enum: ["MANUAL", "MONTH_END", "NEGATIVE_COVERAGE"],
        default: "MANUAL",
      },
      idempotencyKey: {
        type: "string",
        pattern: "^[A-Za-z0-9:_-]{8,100}$",
        description:
          "Case-sensitive and unique per owner. The goal: prefix is reserved. Identical replay returns the original movement; changed payload returns 409.",
      },
    },
  },
  SavingsMovement: movementSchema,
  SavingsOccurrence: {
    type: "object",
    required: [
      "accountId",
      "goalId",
      "month",
      "operationDate",
      "title",
      "amountMinorUnits",
      "currency",
    ],
    properties: {
      accountId: identifier,
      goalId: identifier,
      month,
      operationDate: civilDate,
      title: text,
      amountMinorUnits: positiveCents,
      currency,
    },
  },
  SavingsGoalLinkInput: {
    type: "object",
    additionalProperties: false,
    required: ["goalId"],
    properties: { goalId: identifier },
  },
  SavingsResolutionInput: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: { status: { type: "string", enum: ["CONFIRMED", "CANCELED"] } },
  },
  SavingsResolution: {
    type: "object",
    required: ["status", "movement"],
    properties: {
      status: { type: "string", enum: ["CONFIRMED", "CANCELED"] },
      movement: { ...movementSchema, nullable: true },
    },
  },
  CurrentAccount: {
    type: "object",
    required: [
      "type",
      "month",
      "currency",
      "balanceMinorUnits",
      "balanceBasis",
      "carryFromMonth",
      "budget",
    ],
    properties: {
      type: { type: "string", enum: ["CURRENT"] },
      month,
      currency,
      balanceMinorUnits: {
        type: "integer",
        description:
          "Signed existing real available budget, including transfers; not a connected bank balance.",
      },
      balanceBasis: { type: "string", enum: ["AVAILABLE_BUDGET"] },
      carryFromMonth: { ...month, nullable: true },
      budget: {
        type: "object",
        description:
          "Existing real budget summary, including fixed base and carry.",
      },
    },
  },
  CurrentAccountMovement: {
    type: "object",
    required: [
      "id",
      "source",
      "operationDate",
      "title",
      "kind",
      "signedAmountMinorUnits",
      "accountId",
      "currency",
    ],
    properties: {
      id: identifier,
      source: {
        type: "string",
        enum: ["OPERATION", "VIREMENT", "EXCEPTIONAL_INCOME"],
      },
      operationDate: civilDate,
      title: text,
      kind: { type: "string", enum: ["ENTREE", "DEPENSE", "VIREMENT"] },
      signedAmountMinorUnits: { type: "integer" },
      accountId: { ...identifier, nullable: true },
      currency,
    },
  },
};
const errors = {
  "400": { description: "Invalid identifier" },
  "401": { description: "Authentication required" },
  "404": { description: "Resource not found for this owner" },
  "409": {
    description:
      "Savings conflict; stable error.details.code (see docs/savings-accounts.md)",
  },
  "422": { description: "Invalid body, date, currency or pagination" },
};
const parameter = (name: string, schema: object, location = "path") => ({
  name,
  in: location,
  required: location === "path",
  schema,
});
const filters = [
  parameter("month", month, "query"),
  parameter("currency", currency, "query"),
];
const id = parameter("id", identifier);
const operation = (
  summary: string,
  response: string,
  options: {
    parameters?: object[];
    input?: string;
    paginated?: boolean;
    created?: boolean;
  } = {}
) => ({
  tags: ["Coffre"],
  summary,
  security: [{ accessToken_auth: [] }],
  ...(options.parameters ? { parameters: options.parameters } : {}),
  ...(options.input
    ? {
        requestBody: {
          required: true,
          content: { "application/json": { schema: ref(options.input) } },
        },
      }
    : {}),
  responses: {
    ...errors,
    [options.created ? "201" : "200"]: options.paginated
      ? paginatedCollectionResponse(summary, ref(response))
      : {
          description: summary,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                properties: { data: ref(response) },
              },
            },
          },
        },
  },
});
export const swSavingsRouter = {
  "/savings-accounts": {
    get: operation(
      "List owned savings accounts, including archived accounts",
      "SavingsAccount",
      { parameters: paginationParameters, paginated: true }
    ),
    post: operation(
      "Create a savings account without debiting the current budget",
      "SavingsAccount",
      { input: "SavingsAccountInput", created: true }
    ),
  },
  "/savings-accounts/{id}": {
    get: operation("Read a savings balance", "SavingsAccount", {
      parameters: [id],
    }),
    patch: operation("Rename or archive a savings account", "SavingsAccount", {
      parameters: [id],
      input: "SavingsAccountPatch",
    }),
  },
  "/savings-accounts/{id}/goal": {
    put: operation(
      "Link one owned goal; import legacy savedAmount into a pristine account",
      "SavingsAccount",
      { parameters: [id], input: "SavingsGoalLinkInput" }
    ),
  },
  "/savings-accounts/{id}/transfers": {
    post: operation(
      "Record or replay an immutable current/savings transfer, excluded from Analytics",
      "SavingsMovement",
      { parameters: [id], input: "SavingsTransferInput", created: true }
    ),
  },
  "/savings-accounts/{id}/movements": {
    get: operation(
      "Read savings ledger, newest insertion first",
      "SavingsMovement",
      { parameters: [id, ...paginationParameters], paginated: true }
    ),
  },
  "/savings-occurrences/pending": {
    get: operation(
      "List monthly goal transfers to confirm, for one month/currency",
      "SavingsOccurrence",
      { parameters: [...filters, ...paginationParameters], paginated: true }
    ),
  },
  "/savings-accounts/{id}/occurrences/{month}": {
    put: operation(
      "Confirm once or cancel a monthly transfer; identical decisions replay",
      "SavingsResolution",
      {
        parameters: [id, parameter("month", month)],
        input: "SavingsResolutionInput",
      }
    ),
  },
  "/accounts/current": {
    get: operation(
      "Read existing real available budget as the current account",
      "CurrentAccount",
      { parameters: filters }
    ),
  },
  "/accounts/current/movements": {
    get: operation(
      "Read one-off operations and transfers for one month/currency",
      "CurrentAccountMovement",
      { parameters: [...filters, ...paginationParameters], paginated: true }
    ),
  },
};
