import { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { PaginationRequest, parsePaginationRequest } from "../../pagination";
import { ErrorCode, ErrorException } from "../../../utils/errors";

const bodySchema = Joi.object({
  title: Joi.string().trim().min(2).max(50).required(),
  amount: Joi.alternatives()
    .try(
      Joi.number().positive().max(99999999.99).precision(2).strict(),
      Joi.string().pattern(/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
    )
    .required(),
  currency: Joi.string().trim().length(3).uppercase().required(),
  kind: Joi.string().valid("DEPENSE", "ENTREE").required(),
  startDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required(),
  recurrence: Joi.string().valid("AUCUNE", "MENSUELLE").required(),
  endDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null)
    .optional(),
}).unknown(false);

export const validateMonthlyEventBody = async (
  req: Request,
  _: Response,
  next: NextFunction
): Promise<void> => {
  try {
    req.body = await bodySchema.validateAsync(req.body, {
      abortEarly: false,
      convert: true,
    });
    next();
  } catch (error) {
    next(
      new ErrorException(
        ErrorCode.ValidationFailed,
        "Request validation failed",
        Joi.isError(error)
          ? error.details.map((detail) => ({
              field: detail.path.join("."),
              message: detail.message,
              rule: detail.type,
            }))
          : undefined
      )
    );
  }
};

export const parseEventId = (value: string): number => {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ErrorException(ErrorCode.WrongParamsID);
  }
  return Number(value);
};

export const parseOccurrenceQuery = (
  query: Readonly<Record<string, unknown>>
): { month: string; pagination: PaginationRequest } => {
  if (
    Object.keys(query).some(
      (key) => key !== "month" && key !== "limit" && key !== "cursor"
    )
  ) {
    throw new ErrorException(
      ErrorCode.ValidationFailed,
      "Month parameter is invalid"
    );
  }
  const month = query.month;
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new ErrorException(
      ErrorCode.ValidationFailed,
      "Month parameter is invalid"
    );
  }
  return {
    month,
    pagination: parsePaginationRequest({
      ...(query.limit === undefined ? {} : { limit: query.limit }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    }),
  };
};
