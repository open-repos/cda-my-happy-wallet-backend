import { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { PaginationRequest, parsePaginationRequest } from "../../pagination";

const civilDatePattern = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const isCivilDate = (value: unknown): value is string =>
  typeof value === "string" &&
  civilDatePattern.test(value) &&
  new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

const realizeBodySchema = Joi.object({
  categoryId: Joi.number().integer().positive().required(),
  title: Joi.string().trim().min(2).max(50).optional(),
  amount: Joi.alternatives()
    .try(
      Joi.number().positive().max(99999999.99).precision(2).strict(),
      Joi.string().pattern(/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
    )
    .optional(),
  operationDate: Joi.string().pattern(civilDatePattern).optional(),
}).unknown(false);

export const validateRealizeBody = async (
  req: Request,
  _: Response,
  next: NextFunction
): Promise<void> => {
  try {
    req.body = await realizeBodySchema.validateAsync(req.body ?? {}, {
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

export const parseOccurrenceParams = (
  params: Readonly<Record<string, string>>
): { eventId: number; occurrenceDate: string } => {
  const { eventId, date } = params;
  if (!/^[1-9]\d*$/.test(eventId) || !Number.isSafeInteger(Number(eventId))) {
    throw new ErrorException(ErrorCode.WrongParamsID);
  }
  if (!isCivilDate(date)) {
    throw new ErrorException(
      ErrorCode.ValidationFailed,
      "Occurrence date is invalid"
    );
  }
  return { eventId: Number(eventId), occurrenceDate: date };
};

export const parsePendingQuery = (
  query: Readonly<Record<string, unknown>>
): { through: string | undefined; pagination: PaginationRequest } => {
  const { through, ...pagination } = query;
  if (through !== undefined && !isCivilDate(through)) {
    throw new ErrorException(
      ErrorCode.ValidationFailed,
      "Through parameter is invalid"
    );
  }
  return {
    through: through as string | undefined,
    pagination: parsePaginationRequest(pagination),
  };
};
