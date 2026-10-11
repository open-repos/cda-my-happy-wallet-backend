import { Request, Response } from "express";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { OperationAnalyticsUseCases } from "../application/OperationAnalyticsUseCases";
import { OperationAnalyticsError } from "../domain";
import { parseAnalyticsRequest } from "./operationAnalyticsValidators";

export class OperationAnalyticsController {
  public constructor(private readonly analytics: OperationAnalyticsUseCases) {}

  public async operations(req: Request, res: Response): Promise<Response> {
    const query = parseAnalyticsRequest(req.query);
    const data = await this.analytics.aggregate(
      Number(getAuthenticatedUserId(req)),
      query
    );
    return res.status(200).json({ data });
  }
}

/** `422` avec un code stable dans `error.details.code`. */
export const toOperationAnalyticsHttpError = (error: unknown): Error => {
  if (error instanceof ErrorException) return error;
  if (error instanceof OperationAnalyticsError) {
    return new ErrorException(
      ErrorCode.ValidationFailed,
      "Analytics request is invalid",
      { code: error.code }
    );
  }
  return error instanceof Error ? error : new Error("Unknown analytics error");
};
