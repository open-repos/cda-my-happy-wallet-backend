import { Request, Response } from "express";
import Joi from "joi";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { parsePaginationRequest } from "../../pagination";
import { parseResourceId } from "../../operations/presentation/operationValidators";
import {
  ReconciliationRepository,
  EnvelopeInput,
} from "../application/ReconciliationRepository";
import { inputAmount, ReconciliationError } from "../domain/Reconciliation";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";

export const integration = {
  mode: "TRACKING_ONLY",
  globalBudgetAdjusted: false,
  warning: "GLOBAL_RAV_FORECAST_SAVINGS_UNCHANGED",
};
const monthSchema = Joi.string().pattern(
  /^(19[7-9]\d|[2-9]\d{3})-(0[1-9]|1[0-2])$/
);
const currencySchema = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z]{3}$/);
const amountSchema = Joi.alternatives()
  .try(Joi.string(), Joi.number())
  .custom((value, helpers) => {
    try {
      return inputAmount(value);
    } catch {
      return helpers.error("any.invalid");
    }
  });
const envelopeSchema = Joi.object({
  title: Joi.string().trim().min(2).max(50).required(),
  amount: amountSchema.required(),
  currency: currencySchema.required(),
  categoryId: Joi.number()
    .integer()
    .positive()
    .max(2147483647)
    .allow(null)
    .default(null),
  startMonth: monthSchema.required(),
  endMonth: monthSchema.allow(null).default(null),
}).unknown(false);
const validate = <T>(schema: Joi.Schema, value: unknown): T => {
  const result = schema.validate(value, { convert: true, abortEarly: false });
  if (result.error) throw new ReconciliationError("INVALID_REQUEST");
  return result.value as T;
};

export class ReconciliationController {
  constructor(
    private readonly repository: ReconciliationRepository,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}
  private owner(req: Request) {
    return Number(getAuthenticatedUserId(req));
  }
  private id(value: string) {
    const id = parseResourceId(value);
    if (id > 2147483647) throw new ReconciliationError("INVALID_REQUEST");
    return id;
  }
  private month(value: unknown): string {
    const month = validate<string>(monthSchema.required(), value);
    const delta =
      (Number(month.slice(0, 4)) - Number(this.today().slice(0, 4))) * 12 +
      Number(month.slice(5)) -
      Number(this.today().slice(5, 7));
    if (delta > 23) throw new ReconciliationError("MONTH_TOO_FAR");
    return month;
  }
  private empty(req: Request) {
    validate(Joi.object({}).unknown(false), req.query);
    validate(Joi.object({}).unknown(false), req.body ?? {});
  }
  async listEnvelopes(req: Request, res: Response) {
    const { month, ...query } = req.query;
    const result = await this.repository.listEnvelopes(
      this.owner(req),
      parsePaginationRequest(query),
      month === undefined ? undefined : this.month(month)
    );
    return res.json(result);
  }
  async getEnvelope(req: Request, res: Response) {
    this.empty(req);
    return res.json({
      data: await this.repository.getEnvelope(
        this.owner(req),
        this.id(req.params.id)
      ),
    });
  }
  async saveEnvelope(req: Request, res: Response) {
    validate(Joi.object({}).unknown(false), req.query);
    const input = validate<EnvelopeInput>(envelopeSchema, req.body);
    if (input.endMonth && input.endMonth < input.startMonth)
      throw new ReconciliationError("INVALID_REQUEST");
    const id = req.params.id ? this.id(req.params.id) : undefined;
    const data = await this.repository.saveEnvelope(this.owner(req), input, id);
    if (id === undefined) res.location(`${req.originalUrl}/${data.id}`);
    return res.status(id === undefined ? 201 : 200).json({ data });
  }
  async archiveEnvelope(req: Request, res: Response) {
    this.empty(req);
    await this.repository.archiveEnvelope(
      this.owner(req),
      this.id(req.params.id)
    );
    return res.status(204).send();
  }
  async listOccurrences(req: Request, res: Response) {
    const { currency, ...query } = req.query;
    const month = this.month(req.params.month);
    const page = await this.repository.listOccurrences(
      this.owner(req),
      month,
      validate<string>(currencySchema.required(), currency),
      parsePaginationRequest(query)
    );
    return res.json({
      ...page,
      integration,
      historyPolicy: "MATERIALIZED_SNAPSHOTS_ONLY",
    });
  }
  async summary(req: Request, res: Response) {
    const { currency, ...query } = req.query;
    validate(Joi.object({}).unknown(false), query);
    const data = await this.repository.summary(
      this.owner(req),
      this.month(req.params.month),
      validate<string>(currencySchema.required(), currency)
    );
    return res.json({ data, integration });
  }
  async getOccurrence(req: Request, res: Response) {
    this.empty(req);
    return res.json({
      data: await this.repository.getOccurrence(
        this.owner(req),
        this.id(req.params.id)
      ),
      integration,
    });
  }
  async updateOccurrence(req: Request, res: Response) {
    validate(Joi.object({}).unknown(false), req.query);
    const input = validate<{ planned: string }>(
      Joi.object({ planned: amountSchema.required() }).unknown(false),
      req.body
    );
    return res.json({
      data: await this.repository.updateOccurrence(
        this.owner(req),
        this.id(req.params.id),
        input.planned
      ),
      integration,
    });
  }
  async listOperations(req: Request, res: Response) {
    const { unassociated, ...query } = req.query;
    if (
      unassociated !== undefined &&
      unassociated !== "true" &&
      unassociated !== "false"
    )
      throw new ReconciliationError("INVALID_REQUEST");
    return res.json(
      await this.repository.listOperations(
        this.owner(req),
        this.id(req.params.id),
        unassociated === "true",
        parsePaginationRequest(query)
      )
    );
  }
  async getLink(req: Request, res: Response) {
    this.empty(req);
    return res.json({
      data: await this.repository.getLink(
        this.owner(req),
        this.id(req.params.id)
      ),
      integration,
    });
  }
  async link(req: Request, res: Response) {
    validate(Joi.object({}).unknown(false), req.query);
    const input = validate<{
      occurrenceId: number | null;
      expectedOccurrenceId: number | null;
    }>(
      Joi.object({
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
      }).unknown(false),
      req.body
    );
    await this.repository.link(
      this.owner(req),
      this.id(req.params.id),
      input.occurrenceId,
      input.expectedOccurrenceId
    );
    return res.status(204).send();
  }
  async suggestions(req: Request, res: Response) {
    const page = await this.repository.suggestions(
      this.owner(req),
      this.id(req.params.id),
      parsePaginationRequest(req.query)
    );
    return res.json({
      ...page,
      automatic: false,
      selectionRequired: true,
      ambiguous:
        page.data.length > 1 ||
        page.meta.hasNext ||
        req.query.cursor !== undefined,
    });
  }
  async eligibility(req: Request, res: Response) {
    return res.json(
      await this.repository.eligibility(
        this.owner(req),
        parsePaginationRequest(req.query)
      )
    );
  }
}
