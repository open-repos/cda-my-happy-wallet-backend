import {
  fixedChargeDtoSchema,
  fixedIncomeDtoSchema,
} from "./fixedChargeSwagger";
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
  FixedMonthOperation: {
    oneOf: [
      {
        ...fixedChargeDtoSchema,
        properties: { ...fixedChargeDtoSchema.properties, id },
        required: [...fixedChargeDtoSchema.required, "id", "typeOperation"],
      },
      {
        ...fixedIncomeDtoSchema,
        properties: { ...fixedIncomeDtoSchema.properties, id },
        required: [...fixedIncomeDtoSchema.required, "id", "typeOperation"],
      },
    ],
  },
  EnvelopeStatistics: object({
    sampleMonths: { type: "integer", minimum: 0 },
    completedMonthsObserved: { type: "integer", minimum: 0 },
    unreconciledMonthsExcluded: { type: "integer", minimum: 0 },
    incompleteMonthsExcluded: { type: "integer", minimum: 0 },
    meanActual: { ...amount, nullable: true },
    meanPlanned: { ...amount, nullable: true },
    meanVariance: {
      type: "string",
      nullable: true,
      pattern: "^-?[0-9]+\\.[0-9]{2}$",
    },
    meanOverrun: { ...amount, nullable: true },
    exceededMonths: { type: "integer", minimum: 0 },
    overrunRate: { type: "number", nullable: true, minimum: 0, maximum: 100 },
    samplePolicy: {
      type: "string",
      enum: ["COMPLETED_MONTHS_WITH_LINKED_OPERATIONS"],
    },
  }),
  EnvelopeMonthOverview: object({
    occurrenceId: id,
    month,
    categoryId: nullableId,
    planned: amount,
    actual: amount,
    remaining: amount,
    overrun: amount,
    projected: amount,
    progress: { type: "number", nullable: true },
    status: { type: "string", enum: ["AVAILABLE", "REACHED", "EXCEEDED"] },
    operationCount: { type: "integer", minimum: 0 },
    paymentsPath: { type: "string" },
    paymentsPreview: {
      type: "array",
      maxItems: 3,
      items: object({
        id,
        title: { type: "string" },
        amount,
        operationDate: { type: "string", format: "date" },
      }),
    },
  }),
  EnvelopeOverview: object({
    id,
    title: { type: "string" },
    currency,
    category: { type: "object", nullable: true },
    totals: {
      type: "object",
      description:
        "Metrics on observed months, observedMonths, operationCount and sumMonthlyOverrun. Annual net overrun and sum of monthly overruns are distinct.",
    },
    months: {
      type: "array",
      maxItems: 12,
      items: ref("EnvelopeMonthOverview"),
    },
    statistics: ref("EnvelopeStatistics"),
  }),
  EnvelopeCategoryAnalysis: object({
    id: { type: "integer", minimum: 0 },
    category: { type: "object", nullable: true },
    statistics: ref("EnvelopeStatistics"),
    months: {
      type: "array",
      maxItems: 12,
      items: object({
        month,
        planned: amount,
        actual: amount,
        operationCount: { type: "integer", minimum: 0 },
        unreconciledEnvelopes: { type: "integer", minimum: 0 },
      }),
    },
  }),

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
    mode: { type: "string", enum: ["INTEGRATED"] },
    globalBudgetAdjusted: { type: "boolean", enum: [true] },
    policy: { type: "string", enum: ["OPEN_RESERVED_CLOSED_MATCHED_ACTUAL"] },
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
      enum: [
        "ELIGIBLE",
        "NOT_BUDGET_ENVELOPE",
        "INCOME_NOT_ELIGIBLE",
        "NON_MONTHLY_WITHOUT_DUE_DATE",
        "MISSING_CURRENCY",
      ],
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
  "/envelope-overview": {
    get: action(
      "Monthly/yearly envelope overview with three-payment previews; observed history only",
      [
        parameter("month", "query", month, false),
        parameter(
          "year",
          "query",
          { type: "integer", minimum: 1970, maximum: 9999 },
          false
        ),
        currencyParam,
        ...paginationParameters,
      ],
      {
        "200": list("EnvelopeOverview", {
          range: object({ from: month, to: month, currency }),
          historyPolicy: { type: "string", enum: ["OBSERVED_ONLY"] },
        }),
      }
    ),
  },
  "/envelope-analytics": {
    get: action(
      "Means and overrun frequency by envelope category on at most 12 months; excludes incomplete and unreconciled months",
      [
        parameter("from", "query", month),
        parameter("to", "query", month),
        currencyParam,
        ...paginationParameters,
      ],
      {
        "200": list("EnvelopeCategoryAnalysis", {
          range: object({ from: month, to: month, currency }),
          historyPolicy: { type: "string", enum: ["OBSERVED_ONLY"] },
        }),
      }
    ),
  },
  "/operations-fixes/months/{month}": {
    get: action(
      "Dated view of fixed charges and income, applying scheduled versions without changing past periods",
      [monthParam, ...paginationParameters],
      {
        "200": list("FixedMonthOperation"),
      }
    ),
  },

  "/budget-envelopes": {
    get: action(
      "List definitions; optional month selects active definitions, historical snapshots are in occurrences",
      [...paginationParameters, parameter("month", "query", month, false)],
      { "200": list("BudgetEnvelope") }
    ),
    post: action(
      "Create a monthly fixed charge explicitly marked as a budget envelope (alias; zero allowed)",
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
      "Edit an opted-in fixed charge; open occurrences update from the effective month, closed snapshots remain unchanged",
      [idParam],
      { "200": response("BudgetEnvelope") },
      body(ref("BudgetEnvelopeInput"))
    ),
    delete: action(
      "Archive an opted-in fixed charge idempotently; reject open linked payments; preserve closed history",
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
    get: action(
      "Read snapshot and exact personal-basis envelope metrics",
      [idParam],
      {
        "200": response("ReconciliationOccurrence", true),
      }
    ),
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
