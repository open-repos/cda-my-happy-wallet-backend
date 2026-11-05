import { NextFunction, Request, Response } from "express";
import Joi, { ObjectSchema } from "joi";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { PaginationRequest, parsePaginationRequest } from "../../pagination";
import {
  OperationListFilter,
  OperationListSort,
  OperationSortField,
} from "../application";

const categoryBodySchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required(),
  color: Joi.string()
    .pattern(/^#[0-9A-F]{6}$/i)
    .allow(null)
    .optional(),
  // Validée par le cas d'usage pour répondre avec `INVALID_CATEGORY_ICON`.
  icon: Joi.any().optional(),
}).unknown(false);

const operationBodySchema = Joi.object({
  title: Joi.string().trim().min(2).max(50).required(),
  amount: Joi.alternatives()
    .try(
      Joi.number()
        .positive()
        .max(99999999.99)
        .custom((value: number, helpers) =>
          Number.isInteger(value * 100)
            ? value
            : helpers.error("number.precision")
        ),
      Joi.string().pattern(/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
    )
    .required(),
  currency: Joi.string().trim().length(3).uppercase().required(),
  kind: Joi.string().valid("DEPENSE", "ENTREE").required(),
  operationDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  categoryId: Joi.number().integer().positive().required(),
  reconciliation: Joi.object({
    occurrenceId: Joi.number()
      .integer()
      .positive()
      .max(2147483647)
      .allow(null)
      .required(),
    expectedOccurrenceId: Joi.number()
      .integer()
      .positive()
      .max(2147483647)
      .allow(null)
      .required(),
  })
    .unknown(false)
    .optional(),
}).unknown(false);

const validateBody =
  (schema: ObjectSchema) =>
  async (req: Request, _: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.validateAsync(req.body, {
        abortEarly: false,
        convert: true,
      });
      next();
    } catch (error) {
      const details = Joi.isError(error)
        ? error.details.map((detail) => ({
            field: detail.path.join("."),
            message: detail.message,
            rule: detail.type,
          }))
        : undefined;
      next(
        new ErrorException(
          ErrorCode.ValidationFailed,
          "Request validation failed",
          details
        )
      );
    }
  };

export const validateCategoryBody = validateBody(categoryBodySchema);
export const validateOperationBody = validateBody(operationBodySchema);

export const parseResourceId = (value: string): number => {
  if (!/^[1-9]\d*$/.test(value)) {
    throw new ErrorException(ErrorCode.WrongParamsID);
  }
  const id = Number(value);
  if (!Number.isSafeInteger(id)) {
    throw new ErrorException(ErrorCode.WrongParamsID);
  }
  return id;
};

const civilDate = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const isCivilDate = (value: unknown): value is string =>
  typeof value === "string" &&
  civilDate.test(value) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

const invalidFilter = () =>
  new ErrorException(
    ErrorCode.ValidationFailed,
    "Operation filter parameters are invalid"
  );

const SORT_FIELDS: readonly OperationSortField[] = [
  "date",
  "title",
  "category",
  "amount",
];
const MAX_CATEGORY_FILTERS = 20;
const amountPattern = /^(0|[1-9]\d{0,7})(?:\.(\d{1,2}))?$/;

/** Montant au format saisi, normalisé à deux décimales (`12.5` → `12.50`). */
const parseAmount = (value: unknown): string => {
  const match = typeof value === "string" ? amountPattern.exec(value) : null;
  if (match === null) throw invalidFilter();
  return `${match[1]}.${(match[2] ?? "").padEnd(2, "0")}`;
};

const toCents = (amount: string): number => Math.round(Number(amount) * 100);

/** Une ou plusieurs valeurs `categoryId`, triées et sans doublon. */
const parseCategoryIds = (value: unknown): readonly number[] => {
  const values = Array.isArray(value) ? value : [value];
  if (values.length === 0 || values.length > MAX_CATEGORY_FILTERS) {
    throw invalidFilter();
  }
  const ids = values.map((item) => {
    if (typeof item !== "string" || !/^[1-9]\d{0,9}$/.test(item)) {
      throw invalidFilter();
    }
    const id = Number(item);
    if (!Number.isSafeInteger(id) || id > 2147483647) throw invalidFilter();
    return id;
  });
  return [...new Set(ids)].sort((a, b) => a - b);
};

const parseTitle = (value: unknown): string => {
  if (typeof value !== "string") throw invalidFilter();
  const title = value.trim();
  if (title.length === 0 || title.length > 50) throw invalidFilter();
  return title;
};

const parseSort = (
  sort: unknown,
  order: unknown
): OperationListSort | undefined => {
  if (sort === undefined) {
    if (order !== undefined) throw invalidFilter();
    return undefined;
  }
  if (!SORT_FIELDS.includes(sort as OperationSortField)) throw invalidFilter();
  if (order !== undefined && order !== "asc" && order !== "desc") {
    throw invalidFilter();
  }
  return {
    field: sort as OperationSortField,
    order: (order as "asc" | "desc" | undefined) ?? "asc",
  };
};

/**
 * Paramètres de `GET /operations`. `from` et `to` sont inclusifs ; une
 * journée utilise la même date pour les deux. Tout paramètre inconnu est
 * refusé par `parsePaginationRequest`.
 */
export const parseOperationListQuery = (
  query: Readonly<Record<string, unknown>>
): {
  filter: OperationListFilter;
  sort: OperationListSort | undefined;
  pagination: PaginationRequest;
} => {
  const {
    from,
    to,
    currency,
    sort,
    order,
    title,
    categoryId,
    type,
    minAmount,
    maxAmount,
    ...pagination
  } = query;
  if (from !== undefined && !isCivilDate(from)) throw invalidFilter();
  if (to !== undefined && !isCivilDate(to)) throw invalidFilter();
  if (from !== undefined && to !== undefined && from > to) {
    throw invalidFilter();
  }
  if (
    currency !== undefined &&
    (typeof currency !== "string" || !/^[A-Za-z]{3}$/.test(currency))
  ) {
    throw invalidFilter();
  }
  if (type !== undefined && type !== "DEPENSE" && type !== "ENTREE") {
    throw invalidFilter();
  }
  const min = minAmount === undefined ? undefined : parseAmount(minAmount);
  const max = maxAmount === undefined ? undefined : parseAmount(maxAmount);
  if (min !== undefined && max !== undefined && toCents(min) > toCents(max)) {
    throw invalidFilter();
  }
  return {
    filter: {
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(currency === undefined ? {} : { currency: currency.toUpperCase() }),
      ...(title === undefined ? {} : { title: parseTitle(title) }),
      ...(categoryId === undefined
        ? {}
        : { categoryIds: parseCategoryIds(categoryId) }),
      ...(type === undefined ? {} : { kind: type }),
      ...(min === undefined ? {} : { minAmount: min }),
      ...(max === undefined ? {} : { maxAmount: max }),
    },
    sort: parseSort(sort, order),
    pagination: parsePaginationRequest(pagination),
  };
};

/** Les suggestions s'affichent par pages courtes dans un champ de filtre. */
const TITLE_SUGGESTION_LIMITS = { defaultLimit: 10, maxLimit: 50 } as const;

/**
 * Paramètres de `GET /operations/suggestions/titles`. `q` est facultatif :
 * vide après suppression des espaces aux extrémités, il ne filtre rien.
 */
export const parseTitleSuggestionQuery = (
  query: Readonly<Record<string, unknown>>
): { query: string | undefined; pagination: PaginationRequest } => {
  const { q, ...pagination } = query;
  if (q !== undefined && typeof q !== "string") throw invalidFilter();
  const search = q?.trim() ?? "";
  if (search.length > 50) throw invalidFilter();
  return {
    query: search === "" ? undefined : search,
    pagination: parsePaginationRequest(pagination, TITLE_SUGGESTION_LIMITS),
  };
};
