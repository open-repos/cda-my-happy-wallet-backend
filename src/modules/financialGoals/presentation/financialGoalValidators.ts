import { NextFunction, Request, Response } from "express";
import Joi from "joi";
import { ErrorCode, ErrorException } from "../../../utils/errors";

const amount = (minimum: number) =>
  Joi.alternatives().try(
    Joi.number().min(minimum).max(99999999.99).precision(2).strict(),
    Joi.string().pattern(/^(0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
  );

const bodySchema = Joi.object({
  title: Joi.string().trim().min(2).max(50).required(),
  targetAmount: amount(0.01).required(),
  savedAmount: amount(0).default("0.00"),
  monthlyContribution: amount(0).default("0.00"),
  currency: Joi.string().trim().length(3).uppercase().required(),
  targetDate: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .allow(null)
    .optional(),
}).unknown(false);

export const validateFinancialGoalBody = async (
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

export const parseGoalId = (value: string): number => {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new ErrorException(ErrorCode.WrongParamsID);
  }
  return Number(value);
};
