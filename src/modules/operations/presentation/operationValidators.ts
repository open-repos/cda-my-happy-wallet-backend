import { NextFunction, Request, Response } from "express";
import Joi, { ObjectSchema } from "joi";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { PaginationRequest, parsePaginationRequest } from "../../pagination";
import { OperationListFilter } from "../application";

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

/** `from` et `to` sont inclusifs; une journée utilise la même date pour les deux. */
export const parseOperationListQuery = (
  query: Readonly<Record<string, unknown>>
): { filter: OperationListFilter; pagination: PaginationRequest } => {
  const { from, to, currency, ...pagination } = query;
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
  return {
    filter: {
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(currency === undefined ? {} : { currency: currency.toUpperCase() }),
    },
    pagination: parsePaginationRequest(pagination),
  };
};
