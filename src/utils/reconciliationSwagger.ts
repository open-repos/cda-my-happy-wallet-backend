import {
  paginatedCollectionResponse,
  paginationParameters,
} from "./paginationSwagger";
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const amount = {
  type: "string",
  pattern: "^(0|[1-9][0-9]*)\\.[0-9]{2}$",
  example: "300.00",
};
const id = { type: "integer", minimum: 1, maximum: 2147483647 };
const month = {
  type: "string",
  pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$",
  example: "2026-10",
};
const currency = { type: "string", pattern: "^[A-Z]{3}$", example: "EUR" };
const nullableId = { ...id, nullable: true };
const object = (
  properties: Record<string, unknown>,
  required = Object.keys(properties)
) => ({ type: "object", additionalProperties: false, required, properties });
const envelopeProperties = {
  title: { type: "string", minLength: 2, maxLength: 50 },
  amount: {
    oneOf: [
      { type: "number", minimum: 0, maximum: 99999999.99, multipleOf: 0.01 },
      { type: "string", pattern: "^(0|[1-9][0-9]{0,7})(\\.[0-9]{1,2})?$" },
    ],
  },
  currency,
  categoryId: nullableId,
  startMonth: month,
  endMonth: { ...month, nullable: true },
};
export const reconciliationSchemas = {
  ReconciliationAssignment: object({
    operationId: id,
    occurrenceId: nullableId,
  }),
  BudgetEnvelopeInput: object(envelopeProperties, [
    "title",
    "amount",
    "currency",
    "startMonth",
  ]),
  BudgetEnvelope: object({
    ...envelopeProperties,
    amount,
    id,
    archived: { type: "boolean" },
  }),
  ReconciliationIntegration: object({
    mode: { type: "string", enum: ["TRACKING_ONLY"] },
    globalBudgetAdjusted: { type: "boolean", enum: [false] },
    warning: {
      type: "string",
      enum: ["GLOBAL_RAV_FORECAST_SAVINGS_UNCHANGED"],
    },
  }),
  ReconciliationMetrics: object(
    {
      planned: amount,
      actual: amount,
      remaining: amount,
      overrun: amount,
      projected: amount,
      progress: {
        type: "number",
        nullable: true,
        description:
          "Percentage, half-up to 2 decimals; null when planned=0. May exceed 100.",
      },
      status: {
        type: "string",
        enum: [
          "AVAILABLE",
          "REACHED",
          "EXCEEDED",
          "EXPECTED",
          "PARTIAL",
          "RECEIVED",
          "SURPLUS",
          "DUE",
          "PAID",
        ],
      },
      expected: amount,
      received: amount,
      missing: amount,
      surplus: amount,
    },
    [
      "planned",
      "actual",
      "remaining",
      "overrun",
      "projected",
      "progress",
      "status",
    ]
  ),
  ReconciliationOccurrence: object({
    id,
    month,
    sourceType: {
      type: "string",
      enum: ["ENVELOPE", "FIXED_EXPENSE", "FIXED_INCOME"],
    },
    sourceId: id,
    title: { type: "string" },
    currency,
    kind: { type: "string", enum: ["DEPENSE", "ENTREE"] },
    referenceTotal: amount,
    personalShare: amount,
    categoryId: nullableId,
    closed: { type: "boolean" },
    operationCount: { type: "integer", minimum: 0 },
    metrics: ref("ReconciliationMetrics"),
  }),
  ReconciliationOperation: object({
    id,
    title: { type: "string" },
    amount,
    currency,
    type: { type: "string", enum: ["DEPENSE", "ENTREE"] },
    operationDate: { type: "string", format: "date" },
    categoryId: id,
    occurrenceId: nullableId,
  }),
  ReconciliationFixedEligibility: object({
    id,
    title: { type: "string" },
    currency: { ...currency, nullable: true },
    periodicity: {
      type: "string",
      enum: [
        "MENSUELLE",
        "BIMESTRIELLE",
        "TRIMESTRIELLE",
        "SEMESTRIELLE",
        "ANNUELLE",
      ],
    },
    eligible: { type: "boolean" },
    reason: {
      type: "string",
      enum: ["ELIGIBLE", "NON_MONTHLY_WITHOUT_DUE_DATE", "MISSING_CURRENCY"],
    },
  }),
  ReconciliationSummary: object({
    month,
    currency,
    closed: { type: "boolean" },
    scope: {
      type: "string",
      enum: ["TRACKED_OCCURRENCES_AND_UNASSOCIATED_ACTUALS"],
    },
    actualIncome: amount,
    actualExpense: amount,
    unassociatedIncome: amount,
    unassociatedExpense: amount,
    trackedPlannedIncome: amount,
    trackedPlannedExpense: amount,
    projectedIncome: amount,
    projectedExpense: amount,
  }),
};
const errors = {
  "400": {
    description: "Invalid resource identifier",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  "401": {
    description: "Missing or invalid authentication",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  "404": {
    description: "Resource absent or owned by another user",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  "409": {
    description:
      "PERIOD_CLOSED, ASSOCIATION_CONFLICT, ARCHIVED_ENVELOPE, LINKED_OPERATION_INCOMPATIBLE or RETRY_CONFLICT in error.details.code",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
  "422": {
    description:
      "INVALID_REQUEST, INVALID_CATEGORY, MONTH_TOO_FAR, CURRENCY_MISMATCH, TYPE_MISMATCH or PERIOD_MISMATCH in error.details.code; invalid pagination uses the common ValidationFailed contract",
    content: { "application/json": { schema: ref("ErrorResponse") } },
  },
};
const parameter = (
  name: string,
  location: string,
  schema: object,
  required = true
) => ({ name, in: location, required, schema });
const body = (schema: object) => ({
  required: true,
  content: { "application/json": { schema } },
});
const response = (name: string, integrated = false) => ({
  description: "Successful private response",
  content: {
    "application/json": {
      schema: object({
        data: ref(name),
        ...(integrated
          ? { integration: ref("ReconciliationIntegration") }
          : {}),
      }),
    },
  },
});
const list = (name: string, extra: Record<string, unknown> = {}) => {
  const result = paginatedCollectionResponse(
    "Private collection ordered by ascending ID; opaque context-bound cursor",
    ref(name)
  );
  return {
    ...result,
    content: {
      "application/json": {
        schema: object({
          data: { type: "array", items: ref(name) },
          meta: ref("PaginationMeta"),
          ...extra,
        }),
      },
    },
  };
};
const action = (
  summary: string,
  parameters: object[],
  responses: object,
  requestBody?: object
) => ({
  tags: ["Reconciliation"],
  summary,
  security: [{ accessToken_auth: [] }],
  parameters,
  responses: { ...responses, ...errors },
  ...(requestBody ? { requestBody } : {}),
});
const idParam = parameter("id", "path", id);
const monthParam = parameter("month", "path", month);
const currencyParam = parameter("currency", "query", currency);
export const swReconciliationRouter = {
  "/budget-envelopes": {
    get: action(
      "List definitions; optional month selects active definitions, historical snapshots are in occurrences",
      [...paginationParameters, parameter("month", "query", month, false)],
      { "200": list("BudgetEnvelope") }
    ),
    post: action(
      "Create a recurring monthly variable expense envelope (zero allowed)",
      [],
      { "201": response("BudgetEnvelope") },
      body(ref("BudgetEnvelopeInput"))
    ),
  },
  "/budget-envelopes/{id}": {
    get: action("Read an envelope including archived definitions", [idParam], {
      "200": response("BudgetEnvelope"),
    }),
    put: action(
      "Replace definition for unmaterialized months only; existing snapshots remain unchanged",
      [idParam],
      { "200": response("BudgetEnvelope") },
      body(ref("BudgetEnvelopeInput"))
    ),
    delete: action(
      "Archive idempotently; retain all existing occurrences and financial operations",
      [idParam],
      { "204": { description: "Archived" } }
    ),
  },
  "/reconciliation/fixed-eligibility": {
    get: action(
      "Explain eligibility of each fixed source, including non-monthly exclusion",
      paginationParameters,
      { "200": list("ReconciliationFixedEligibility") }
    ),
  },
  "/reconciliation/months/{month}/occurrences": {
    get: action(
      "Materialize open/future snapshots idempotently (at most 23 months ahead), then list; past months only return existing snapshots",
      [monthParam, currencyParam, ...paginationParameters],
      {
        "200": list("ReconciliationOccurrence", {
          integration: ref("ReconciliationIntegration"),
          historyPolicy: {
            type: "string",
            enum: ["MATERIALIZED_SNAPSHOTS_ONLY"],
          },
        }),
      }
    ),
  },
  "/reconciliation/months/{month}/summary": {
    get: action(
      "Tracking totals per currency: projected=max(planned,linked actual) per occurrence + unassociated actual; NOT a RaV/savings balance",
      [monthParam, currencyParam],
      { "200": response("ReconciliationSummary", true) }
    ),
  },
  "/reconciliation/occurrences/{id}": {
    get: action("Read snapshot and exact personal-basis metrics", [idParam], {
      "200": response("ReconciliationOccurrence", true),
    }),
    patch: action(
      "Explicitly override planned amount for an open occurrence; reference snapshot remains intact",
      [idParam],
      { "200": response("ReconciliationOccurrence", true) },
      body(object({ planned: envelopeProperties.amount }))
    ),
  },
  "/reconciliation/occurrences/{id}/operations": {
    get: action(
      "List linked operations, or eligible unassociated payments with unassociated=true; category never prevents explicit linking",
      [
        idParam,
        parameter(
          "unassociated",
          "query",
          { type: "string", enum: ["true", "false"], default: "false" },
          false
        ),
        ...paginationParameters,
      ],
      { "200": list("ReconciliationOperation") }
    ),
  },
  "/operations/{id}/reconciliation": {
    get: action(
      "Read the current assignment before an explicit compare-and-set or reassignment",
      [idParam],
      { "200": response("ReconciliationAssignment", true) }
    ),
    put: action(
      "Associate/reassign/unlink transactionally; null occurrenceId unlinks; expectedOccurrenceId is mandatory compare-and-set; identical target is a read-only replay",
      [idParam],
      {
        "204": {
          description:
            "Applied or already in requested state; no financial movement created",
        },
      },
      body(
        object({ occurrenceId: nullableId, expectedOccurrenceId: nullableId })
      )
    ),
  },
  "/operations/{id}/reconciliation-suggestions": {
    get: action(
      "Suggest by category, type, month and currency; never auto-associate; closed months return none",
      [idParam, ...paginationParameters],
      {
        "200": list("ReconciliationOccurrence", {
          automatic: { type: "boolean", enum: [false] },
          selectionRequired: { type: "boolean", enum: [true] },
          ambiguous: {
            type: "boolean",
            description:
              "True if this page includes multiple candidates or has a next page; client must still explicitly choose",
          },
        }),
      }
    ),
  },
};
