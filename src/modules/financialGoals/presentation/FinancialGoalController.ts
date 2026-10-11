import { Request, Response } from "express";
import { getAuthenticatedUserId } from "../../auth/authenticatedRequest";
import { parsePaginationRequest } from "../../pagination";
import { FinancialGoalUseCases, ForecastedFinancialGoal } from "../application";
import { parseGoalId } from "./financialGoalValidators";

const amountOf = (minorUnits: number): string => (minorUnits / 100).toFixed(2);

export class FinancialGoalController {
  public constructor(private readonly goals: FinancialGoalUseCases) {}

  public async list(req: Request, res: Response): Promise<Response> {
    const page = await this.goals.list(
      this.ownerId(req),
      parsePaginationRequest(req.query)
    );
    return res
      .status(200)
      .json({ data: page.data.map(this.dto), meta: page.meta });
  }

  public async get(req: Request, res: Response): Promise<Response> {
    return res.status(200).json({
      data: this.dto(
        await this.goals.get(this.ownerId(req), parseGoalId(req.params.id))
      ),
    });
  }

  public async create(req: Request, res: Response): Promise<Response> {
    const goal = await this.goals.create(this.ownerId(req), req.body);
    res.location(`${req.originalUrl}/${goal.goal.id}`);
    return res.status(201).json({ data: this.dto(goal) });
  }

  public async update(req: Request, res: Response): Promise<Response> {
    const goal = await this.goals.update(
      this.ownerId(req),
      parseGoalId(req.params.id),
      req.body
    );
    return res.status(200).json({ data: this.dto(goal) });
  }

  public async delete(req: Request, res: Response): Promise<Response> {
    await this.goals.delete(this.ownerId(req), parseGoalId(req.params.id));
    return res.status(204).send();
  }

  private ownerId(req: Request): number {
    return Number(getAuthenticatedUserId(req));
  }

  private readonly dto = ({ goal, forecast }: ForecastedFinancialGoal) => ({
    id: goal.id,
    title: goal.title,
    targetAmount: amountOf(goal.targetMinorUnits),
    savedAmount: amountOf(goal.savedMinorUnits),
    monthlyContribution: amountOf(goal.monthlyContributionMinorUnits),
    currency: goal.currency,
    targetDate: goal.targetDate,
    forecast: {
      referenceMonth: forecast.referenceMonth,
      status: forecast.status,
      remainingAmount: amountOf(forecast.remainingMinorUnits),
      contributionsNeeded: forecast.contributionsNeeded,
      estimatedReachMonth: forecast.estimatedReachMonth,
      requiredMonthlyContribution:
        forecast.requiredMonthlyMinorUnits === null
          ? null
          : amountOf(forecast.requiredMonthlyMinorUnits),
    },
  });
}
