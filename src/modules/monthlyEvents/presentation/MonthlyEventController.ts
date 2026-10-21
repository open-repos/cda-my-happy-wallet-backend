import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { MonthlyEventUseCases } from "../application";
import { MonthlyEvent } from "../domain";
import {
  parseEventId,
  parseEventListQuery,
  parseOccurrenceQuery,
} from "./monthlyEventValidators";

export class MonthlyEventController {
  public constructor(private readonly events: MonthlyEventUseCases) {}

  public async list(req: Request, res: Response): Promise<Response> {
    const query = parseEventListQuery(req.query);
    const page = await this.events.list(
      this.ownerId(req),
      query.pagination,
      query.status
    );
    return res
      .status(200)
      .json({ data: page.data.map(this.dto), meta: page.meta });
  }

  public async occurrences(req: Request, res: Response): Promise<Response> {
    const query = parseOccurrenceQuery(req.query);
    const page = await this.events.occurrences(
      this.ownerId(req),
      query.month,
      query.pagination,
      query.scenario
    );
    return res.status(200).json({
      data: page.data.map((item) => ({
        ...this.dto(item.event),
        occurrenceDate: item.occurrenceDate,
      })),
      meta: page.meta,
    });
  }

  public async get(req: Request, res: Response): Promise<Response> {
    return res.status(200).json({
      data: this.dto(
        await this.events.get(this.ownerId(req), parseEventId(req.params.id))
      ),
    });
  }

  public async create(req: Request, res: Response): Promise<Response> {
    const event = await this.events.create(this.ownerId(req), req.body);
    res.location(`${req.originalUrl}/${event.id}`);
    return res.status(201).json({ data: this.dto(event) });
  }

  public async update(req: Request, res: Response): Promise<Response> {
    const event = await this.events.update(
      this.ownerId(req),
      parseEventId(req.params.id),
      req.body
    );
    return res.status(200).json({ data: this.dto(event) });
  }

  public async delete(req: Request, res: Response): Promise<Response> {
    await this.events.delete(this.ownerId(req), parseEventId(req.params.id));
    return res.status(204).send();
  }

  public async confirm(req: Request, res: Response): Promise<Response> {
    if (
      Object.keys(req.body ?? {}).length > 0 ||
      Object.keys(req.query).length > 0
    )
      throw new ErrorException(
        ErrorCode.ValidationFailed,
        "Confirmation does not accept parameters"
      );
    return res
      .status(200)
      .json({
        data: this.dto(
          await this.events.confirm(
            this.ownerId(req),
            parseEventId(req.params.id)
          )
        ),
      });
  }

  public async clearPotential(req: Request, res: Response): Promise<Response> {
    if (
      Object.keys(req.body ?? {}).length > 0 ||
      Object.keys(req.query).length > 0
    )
      throw new ErrorException(
        ErrorCode.ValidationFailed,
        "Clearing simulation does not accept parameters"
      );
    await this.events.clearPotential(this.ownerId(req));
    return res.status(204).send();
  }

  private ownerId(req: Request): number {
    return Number(getAuthenticatedUserId(req));
  }

  private readonly dto = (event: MonthlyEvent) => ({
    id: event.id,
    title: event.title,
    amount: (event.minorUnits / 100).toFixed(2),
    currency: event.currency,
    kind: event.kind,
    status: event.status,
    startDate: event.startDate,
    recurrence: event.recurrence,
    endDate: event.endDate,
  });
}
