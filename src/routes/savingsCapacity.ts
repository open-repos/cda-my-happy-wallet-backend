import { RequestHandler, Router } from "express";
import { budgetScenarioParameter } from "../utils/budgetScenarioSwagger";
import { prisma } from "../database";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { BudgetForecastService } from "../modules/budgetPeriods/application/BudgetForecastService";
import { PrismaBudgetPeriodRepository } from "../modules/budgetPeriods/infrastructure";
import { toBudgetPeriodHttpError } from "../modules/budgetPeriods/presentation/budgetPeriodHttpError";
import { SavingsCapacityService } from "../modules/financialGoals/application/SavingsCapacityService";
import { PrismaFinancialGoalRepository } from "../modules/financialGoals/infrastructure";
import { SavingsCapacityController } from "../modules/financialGoals/presentation/SavingsCapacityController";
import { toFinancialGoalHttpError } from "../modules/financialGoals/presentation/financialGoalHttpError";
import { CivilDateClock, parisCivilDateClock } from "../utils/civilDateClock";

export const createSavingsCapacityRouter = (
  service: SavingsCapacityService,
  authenticate: RequestHandler = tokenJwtTAuth,
  today: CivilDateClock = parisCivilDateClock
): Router => {
  const router = Router();
  const controller = new SavingsCapacityController(service, today);
  router.get("/savings-capacity", authenticate, (req, res, next) => {
    controller
      .summary(req, res)
      .catch((error) =>
        next(toBudgetPeriodHttpError(toFinancialGoalHttpError(error)))
      );
  });
  return router;
};
export const savingsCapacityRouter = createSavingsCapacityRouter(
  new SavingsCapacityService(
    new BudgetForecastService(new PrismaBudgetPeriodRepository(prisma)),
    new PrismaFinancialGoalRepository(prisma)
  )
);

const amount = { type: "string", pattern: "^-?\\d+\\.\\d{2}$" };
const optionalAmount = { ...amount, nullable: true };
const monthProperties = {
  month: { type: "string" },
  beforeGoals: amount,
  afterPlanned: amount,
  afterRequired: optionalAmount,
  sustainability: {
    type: "string",
    enum: ["TENABLE", "TENDU", "NON_TENABLE", "INDETERMINE"],
  },
};
const goalProperties = {
  id: { type: "integer" },
  title: { type: "string" },
  targetDate: { type: "string", format: "date", nullable: true },
  plannedMonthlyContribution: amount,
  requiredMonthlyContribution: optionalAmount,
  monthlyContributionGap: optionalAmount,
  includedInTotals: { type: "boolean" },
  status: {
    type: "string",
    enum: ["NO_DEADLINE", "ON_TRACK", "BEHIND", "MISSED"],
  },
};
const properties = {
  from: { type: "string" },
  currency: { type: "string" },
  referenceDate: { type: "string", format: "date" },
  totalPlannedMonthlyContribution: amount,
  totalRequiredMonthlyContribution: optionalAmount,
  unassessableCount: { type: "integer", minimum: 0 },
  goals: {
    type: "array",
    items: {
      type: "object",
      required: Object.keys(goalProperties),
      properties: goalProperties,
    },
  },
  months: {
    type: "array",
    minItems: 1,
    maxItems: 24,
    items: {
      type: "object",
      required: Object.keys(monthProperties),
      properties: monthProperties,
    },
  },
};
export const swSavingsCapacityRouter = {
  "/savings-capacity": {
    get: {
      tags: ["Objectifs"],
      summary: "Read personal savings capacity and monthly goal effort",
      description:
        "Independent cumulative scenarios before goals, after planned and after required contributions. Expired potential events are deleted before reading. Only scenario=simulation includes remaining potentials. Required amounts are unknown for missing/past deadlines. See docs/savings-capacity.md and docs/budget-simulation.md.",
      security: [{ accessToken_auth: [] }],
      parameters: [
        budgetScenarioParameter,
        {
          name: "from",
          in: "query",
          required: true,
          description: "Current month or one of the next 23 months",
          schema: { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" },
        },
        {
          name: "months",
          in: "query",
          schema: { type: "integer", minimum: 1, maximum: 24, default: 12 },
        },
        {
          name: "currency",
          in: "query",
          required: true,
          schema: { type: "string", pattern: "^[A-Za-z]{3}$" },
        },
      ],
      responses: {
        "200": {
          description: "Savings capacity in decimal-string amounts",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                properties: {
                  data: {
                    type: "object",
                    required: Object.keys(properties),
                    properties,
                  },
                },
              },
            },
          },
        },
        "401": { description: "Missing or invalid access token" },
        "422": { description: "Invalid query, date, currency or amount" },
      },
    },
  },
};
