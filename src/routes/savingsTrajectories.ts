import { RequestHandler, Router } from "express";
import { tokenJwtTAuth } from "../middlewares/authenticateToken.middleware";
import { getAuthenticatedUserId } from "../modules/auth/authenticatedRequest";
import { toBudgetPeriodHttpError } from "../modules/budgetPeriods/presentation/budgetPeriodHttpError";
import { SavingsTrajectoryService } from "../modules/financialGoals/application/SavingsTrajectoryService";
import { parseSavingsTrajectoryRequest } from "../modules/financialGoals/presentation/savingsTrajectoryValidators";
import { CivilDateClock, parisCivilDateClock } from "../utils/civilDateClock";
import { savingsTrajectoryResponseSchema } from "../modules/financialGoals/presentation/savingsTrajectorySchema";

export const createSavingsTrajectoryRouter = (
  service: SavingsTrajectoryService,
  authenticate: RequestHandler = tokenJwtTAuth,
  today: CivilDateClock = parisCivilDateClock
): Router => {
  const router = Router();
  router.post(
    "/savings-capacity/trajectories",
    authenticate,
    async (req, res, next) => {
      try {
        const request = parseSavingsTrajectoryRequest(req.body, req.query);
        const result = await service.calculate(
          Number(getAuthenticatedUserId(req)),
          request,
          today()
        );
        res.status(200).json({ data: result });
      } catch (error) {
        next(toBudgetPeriodHttpError(error));
      }
    }
  );
  return router;
};

const nonnegativeAmount = {
  type: "string",
  pattern: "^(0|[1-9]\\d{0,7})\\.\\d{2}$",
};
const requestProperties = {
  currency: { type: "string", pattern: "^[A-Za-z]{3}$" },
  scenario: {
    type: "string",
    enum: ["standard", "simulation"],
    default: "standard",
  },
  months: {
    type: "integer",
    minimum: 1,
    maximum: 24,
    description: "Includes the current month; at most 23 future contributions",
  },
  selectedGoalId: { type: "integer", minimum: 1 },
  currentRemainingVariableExpense: nonnegativeAmount,
  futureAdditionalVariableExpense: nonnegativeAmount,
  monthlySafetyMargin: nonnegativeAmount,
};
export const swSavingsTrajectoryRouter = {
  "/savings-capacity/trajectories": {
    post: {
      tags: ["Objectifs"],
      summary: "Simulate savings allocation without persisting assumptions",
      description:
        "Read-only repeatable-read snapshot after existing potential-event expiry. planned/maximum/reasonable are projections, not event statuses or budget scenarios. Current positive cash is protected; declared savings are never added to available cash. See docs/savings-trajectories.md.",
      security: [{ accessToken_auth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: Object.keys(requestProperties).filter(
                (key) => key !== "scenario"
              ),
              properties: requestProperties,
            },
          },
        },
      },
      responses: {
        "200": {
          description:
            "Coherent projected allocations, signed decimal-string amounts",
          content: {
            "application/json": { schema: savingsTrajectoryResponseSchema },
          },
        },
        "401": { description: "Missing or invalid access token" },
        "404": {
          description: "Selected goal not found for owner and currency",
        },
        "422": {
          description:
            "Invalid assumptions, horizon, currency or unsafe amount",
        },
      },
    },
  },
};
