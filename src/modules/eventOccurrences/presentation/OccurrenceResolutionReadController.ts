import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { ListOccurrenceResolutions } from "../application/ListOccurrenceResolutions";
import { occurrenceResolutionDto } from "./occurrenceResolutionDto";
import { parseResolutionQuery } from "./eventOccurrenceValidators";

export class OccurrenceResolutionReadController {
  public constructor(private readonly query: ListOccurrenceResolutions) {}
  public async list(req: Request, res: Response): Promise<Response> {
    const { from, to, pagination } = parseResolutionQuery(req.query);
    const page = await this.query.execute(
      Number(getAuthenticatedUserId(req)),
      from,
      to,
      pagination
    );
    return res
      .status(200)
      .json({ data: page.data.map(occurrenceResolutionDto), meta: page.meta });
  }
}
