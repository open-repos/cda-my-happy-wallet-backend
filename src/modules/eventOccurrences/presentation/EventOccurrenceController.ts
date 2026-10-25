import { occurrenceResolutionDto } from "./occurrenceResolutionDto";
import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import {
  EventOccurrenceUseCases,
  OccurrenceResolutionResult,
} from "../application";
import { PendingOccurrence } from "../domain";
import {
  parseOccurrenceParams,
  parsePendingQuery,
} from "./eventOccurrenceValidators";

const amountOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

export class EventOccurrenceController {
  public constructor(private readonly occurrences: EventOccurrenceUseCases) {}

  public async pending(req: Request, res: Response): Promise<Response> {
    const query = parsePendingQuery(req.query);
    const page = await this.occurrences.pending(
      this.ownerId(req),
      query.through,
      query.pagination
    );
    const today = this.occurrences.currentDate();
    return res.status(200).json({
      data: page.data.map((item) => this.pendingDto(item, today)),
      meta: page.meta,
    });
  }

  public async realize(req: Request, res: Response): Promise<Response> {
    const params = parseOccurrenceParams(req.params);
    return this.send(
      res,
      await this.occurrences.realize(
        this.ownerId(req),
        params.eventId,
        params.occurrenceDate,
        req.body
      )
    );
  }

  public async cancel(req: Request, res: Response): Promise<Response> {
    const params = parseOccurrenceParams(req.params);
    return this.send(
      res,
      await this.occurrences.cancel(
        this.ownerId(req),
        params.eventId,
        params.occurrenceDate
      )
    );
  }

  private ownerId(req: Request): number {
    return Number(getAuthenticatedUserId(req));
  }

  /** 201 pour une nouvelle décision, 200 pour le rejeu d'une commande identique. */
  private send(res: Response, result: OccurrenceResolutionResult): Response {
    const { resolution } = result;
    return res.status(result.replayed ? 200 : 201).json({
      data: occurrenceResolutionDto(resolution),
    });
  }

  private pendingDto(item: PendingOccurrence, today: string) {
    return {
      eventId: item.sourceEventId,
      occurrenceDate: item.occurrenceDate,
      title: item.title,
      amount: amountOf(item.minorUnits),
      currency: item.currency,
      kind: item.kind,
      overdue: item.occurrenceDate < today,
    };
  }
}
