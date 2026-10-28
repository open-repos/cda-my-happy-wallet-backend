import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { parsePaginationRequest } from "../../pagination";
import { monthBounds } from "../../budgetPeriods/domain/BudgetPeriod";
import { ReconciliationError } from "../domain/Reconciliation";
import {
  EnvelopeReportingRepository,
  ReportingQuery,
} from "../application/EnvelopeReportingRepository";
import {
  CivilDateClock,
  parisCivilDateClock,
} from "../../../utils/civilDateClock";
const index = (m: string) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5));
export class EnvelopeReportingController {
  constructor(
    private readonly reports: EnvelopeReportingRepository,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}
  private query(req: Request, analytics: boolean) {
    const { month, year, from, to, currency, ...page } = req.query;
    if (typeof currency !== "string" || !/^[a-z]{3}$/i.test(currency))
      throw new ReconciliationError("INVALID_REQUEST");
    let start: string, end: string;
    if (analytics) {
      if (
        month !== undefined ||
        year !== undefined ||
        typeof from !== "string" ||
        typeof to !== "string"
      )
        throw new ReconciliationError("INVALID_REQUEST");
      start = from;
      end = to;
    } else {
      if (
        from !== undefined ||
        to !== undefined ||
        (month !== undefined && year !== undefined)
      )
        throw new ReconciliationError("INVALID_REQUEST");
      if (year !== undefined) {
        if (typeof year !== "string" || !/^(19[7-9]\d|[2-9]\d{3})$/.test(year))
          throw new ReconciliationError("INVALID_REQUEST");
        start = `${year}-01`;
        end = `${year}-12`;
      } else {
        if (month !== undefined && typeof month !== "string")
          throw new ReconciliationError("INVALID_REQUEST");
        start = typeof month === "string" ? month : this.today().slice(0, 7);
        end = start;
      }
    }
    try {
      monthBounds(start);
      monthBounds(end);
    } catch {
      throw new ReconciliationError("INVALID_REQUEST");
    }
    if (
      start > end ||
      index(end) - index(start) > 11 ||
      index(end) - index(this.today().slice(0, 7)) > 23
    )
      throw new ReconciliationError("INVALID_REQUEST");
    return {
      query: {
        from: start,
        to: end,
        currency: currency.toUpperCase(),
      } satisfies ReportingQuery,
      page: parsePaginationRequest(page),
    };
  }
  async overview(req: Request, res: Response) {
    const { query, page } = this.query(req, false);
    return res.json({
      ...(await this.reports.overview(
        Number(getAuthenticatedUserId(req)),
        query,
        page
      )),
      range: query,
      historyPolicy: "OBSERVED_ONLY",
    });
  }
  async analytics(req: Request, res: Response) {
    const { query, page } = this.query(req, true);
    return res.json({
      ...(await this.reports.analytics(
        Number(getAuthenticatedUserId(req)),
        query,
        page
      )),
      range: query,
      historyPolicy: "OBSERVED_ONLY",
    });
  }
  async fixedMonth(req: Request, res: Response) {
    const month = req.params.month;
    try {
      monthBounds(month);
    } catch {
      throw new ReconciliationError("INVALID_REQUEST");
    }
    if (index(month) - index(this.today().slice(0, 7)) > 23)
      throw new ReconciliationError("INVALID_REQUEST");
    return res.json(
      await this.reports.fixedMonth(
        Number(getAuthenticatedUserId(req)),
        month,
        parsePaginationRequest(req.query)
      )
    );
  }
}
