import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { parsePaginationRequest } from "../../pagination";
import { MonthlyEventUseCases } from "../application";
import { MonthlyEvent } from "../domain";
import { parseEventId, parseOccurrenceQuery } from "./monthlyEventValidators";

export class MonthlyEventController {
  public constructor(private readonly events: MonthlyEventUseCases) {}

  public async list(req: Request, res: Response): Promise<Response> {
    const page = await this.events.list(
      this.ownerId(req),
      parsePaginationRequest(req.query)
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
      query.pagination
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

  private ownerId(req: Request): number {
    return Number(getAuthenticatedUserId(req));
  }

  private readonly dto = (event: MonthlyEvent) => ({
    id: event.id,
    title: event.title,
    amount: (event.minorUnits / 100).toFixed(2),
    currency: event.currency,
    kind: event.kind,
    startDate: event.startDate,
    recurrence: event.recurrence,
    endDate: event.endDate,
  });
}
