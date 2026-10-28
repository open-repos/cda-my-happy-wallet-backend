import { RequestHandler, Router } from "express";
import { prisma } from "../database";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { BudgetForecastService } from "../modules/budgetPeriods/application/BudgetForecastService";
import { PrismaBudgetPeriodRepository } from "../modules/budgetPeriods/infrastructure";
import { BudgetForecastController } from "../modules/budgetPeriods/presentation/BudgetForecastController";
import { toBudgetPeriodHttpError } from "../modules/budgetPeriods/presentation/budgetPeriodHttpError";
import { CivilDateClock, parisCivilDateClock } from "../utils/civilDateClock";
import { budgetScenarioParameter } from "../utils/budgetScenarioSwagger";

export const createBudgetForecastRouter = (
  service: BudgetForecastService,
  authenticate: RequestHandler = tokenJwtTAuth,
  today: CivilDateClock = parisCivilDateClock
): Router => {
  const router = Router();
  const controller = new BudgetForecastController(service, today);
  router.get("/budget-forecast", authenticate, (req, res, next) => {
    controller
      .forecast(req, res)
      .catch((error) => next(toBudgetPeriodHttpError(error)));
  });
  return router;
};

export const budgetForecastRouter = createBudgetForecastRouter(
  new BudgetForecastService(new PrismaBudgetPeriodRepository(prisma))
);

const amount = {
  type: "string",
  pattern: "^-?\\d+\\.\\d{2}$",
  example: "120.00",
};
const monthlyProperties = {
  month: { type: "string", example: "2026-10" },
  fixedIncome: amount,
  fixedExpense: amount,
  base: amount,
  carryIn: amount,
  plannedIncome: amount,
  plannedExpense: amount,
  goalSavings: amount,
  reconciliationAdjustment: amount,
  forecastResult: amount,
  forecastRemaining: amount,
  remainingDays: { type: "integer", minimum: 1, maximum: 31 },
  prudentDailyAllowance: amount,
  prudentWeeklyAllowance: amount,
  prudentMonthlyAllowance: amount,
};

export const swBudgetForecastRouter = {
  "/budget-forecast": {
    get: {
      tags: ["ResteAVivre"],
      summary: "Multi-month budget forecast for the authenticated owner",
      description:
        "No period is opened/closed and no occurrence is resolved. Expired potential events are deleted before reading. Only scenario=simulation includes remaining potentials. See docs/budget-forecast.md and docs/budget-simulation.md.",
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
          schema: { type: "string", pattern: "^[A-Za-z]{3}$", example: "EUR" },
        },
      ],
      responses: {
        "200": {
          description: "Projected monthly balances, amounts as decimal strings",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                properties: {
                  data: {
                    type: "object",
                    required: [
                      "from",
                      "currency",
                      "referenceDate",
                      "currentRealRemaining",
                      "months",
                    ],
                    properties: {
                      from: { type: "string" },
                      currency: { type: "string" },
                      referenceDate: { type: "string", format: "date" },
                      currentRealRemaining: amount,
                      months: {
                        type: "array",
                        minItems: 1,
                        maxItems: 24,
                        items: {
                          type: "object",
                          required: Object.keys(monthlyProperties).filter(
                            (key) => key !== "reconciliationAdjustment"
                          ),
                          properties: monthlyProperties,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        "401": { description: "Missing or invalid access token" },
        "422": {
          description:
            "Invalid or unknown query parameters, past/unbounded window, currency or amount",
        },
      },
    },
  },
};
