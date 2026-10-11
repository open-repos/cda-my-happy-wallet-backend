import { CursorPage, PaginationRequest } from "../../pagination";
import {
  FinancialGoal,
  FinancialGoalForecast,
  FinancialGoalProps,
} from "../domain/FinancialGoal";
import { FinancialGoalRepository } from "./FinancialGoalRepository";

export class FinancialGoalApplicationError extends Error {
  public constructor(public readonly code: "GOAL_NOT_FOUND") {
    super(code);
    this.name = "FinancialGoalApplicationError";
  }
}

export type SaveFinancialGoalInput = Omit<FinancialGoalProps, "id" | "ownerId">;

export type ForecastedFinancialGoal = Readonly<{
  goal: FinancialGoal;
  forecast: FinancialGoalForecast;
}>;

/** Date civile du jour; le produit ne connaît pas encore le fuseau de chaque utilisateur. */
export type CivilDateClock = () => string;

export const parisCivilDateClock: CivilDateClock = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export class FinancialGoalUseCases {
  public constructor(
    private readonly repository: FinancialGoalRepository,
    private readonly today: CivilDateClock = parisCivilDateClock
  ) {}

  public async list(
    ownerId: number,
    page: PaginationRequest
  ): Promise<CursorPage<ForecastedFinancialGoal>> {
    const result = await this.repository.listByOwner(ownerId, page);
    const today = this.today();
    return {
      data: result.data.map((goal) => this.withForecast(goal, today)),
      meta: result.meta,
    };
  }

  public async get(
    ownerId: number,
    id: number
  ): Promise<ForecastedFinancialGoal> {
    const goal = await this.repository.findById(id, ownerId);
    if (goal == null) throw new FinancialGoalApplicationError("GOAL_NOT_FOUND");
    return this.withForecast(goal, this.today());
  }

  public async create(
    ownerId: number,
    input: SaveFinancialGoalInput
  ): Promise<ForecastedFinancialGoal> {
    const goal = await this.repository.create(
      FinancialGoal.create({ ...input, ownerId })
    );
    return this.withForecast(goal, this.today());
  }

  public async update(
    ownerId: number,
    id: number,
    input: SaveFinancialGoalInput
  ): Promise<ForecastedFinancialGoal> {
    const goal = await this.repository.update(
      FinancialGoal.create({ ...input, id, ownerId })
    );
    if (goal == null) throw new FinancialGoalApplicationError("GOAL_NOT_FOUND");
    return this.withForecast(goal, this.today());
  }

  public async delete(ownerId: number, id: number): Promise<void> {
    if (!(await this.repository.delete(id, ownerId))) {
      throw new FinancialGoalApplicationError("GOAL_NOT_FOUND");
    }
  }

  private withForecast(
    goal: FinancialGoal,
    today: string
  ): ForecastedFinancialGoal {
    return { goal, forecast: goal.forecast(today) };
  }
}
