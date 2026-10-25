const money = { type: "string", pattern: "^-?\\d+\\.\\d{2}$" };
const month = { type: "string", pattern: "^\\d{4}-(0[1-9]|1[0-2])$" };
const date = { type: "string", format: "date", nullable: true };
const integer = { type: "integer", minimum: 0 };
const boolean = { type: "boolean" };
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const array = (items: unknown, maxItems?: number) => ({
  type: "array",
  items,
  ...(maxItems === undefined ? {} : { maxItems }),
});
const allocation = object({
  goalId: integer,
  reservedContribution: money,
  projectedContribution: money,
  projectedSavedAmount: money,
});
const current = object({
  month,
  serverRemaining: money,
  reservedContributions: money,
  additionalVariableExpense: money,
  safetyMargin: money,
  remainingUnderAssumptions: money,
  cashBalance: money,
  protectedBalance: money,
  fundable: boolean,
});
const projection = object({
  current,
  points: array(
    object({
      month,
      savedAmount: money,
      kind: { type: "string", enum: ["DECLARED", "PROJECTED"] },
      fundable: boolean,
    }),
    24
  ),
  months: array(
    object({
      month,
      knownFlowBeforeGoals: money,
      carryIn: money,
      additionalVariableExpense: money,
      safetyMargin: money,
      capacityBeforeGoals: money,
      existingReservedContributions: money,
      freeSupplement: money,
      allocatedSupplement: money,
      selectedPossibleContribution: money,
      totalPossibleContributions: money,
      totalReservedContributions: money,
      selectedTotalContribution: money,
      carryOut: money,
      protectedBalance: money,
      fundable: boolean,
      allocations: array(allocation),
    }),
    23
  ),
  scheduledReachMonth: { ...month, nullable: true },
  estimatedReachMonth: { ...month, nullable: true },
  reachReason: {
    type: "string",
    enum: [
      "REACHED",
      "PROJECTED",
      "NO_CONTRIBUTION",
      "OUTSIDE_HORIZON",
      "BUDGET_DEFICIT",
    ],
  },
});
export const savingsTrajectoryResponseSchema = object({
  data: object({
    referenceDate: { type: "string", format: "date" },
    currency: { type: "string" },
    scenario: { type: "string", enum: ["standard", "simulation"] },
    selectedGoalId: integer,
    assumptions: object({
      currentRemainingVariableExpense: money,
      futureAdditionalVariableExpense: money,
      monthlySafetyMargin: money,
    }),
    goals: array(
      object({
        id: integer,
        title: { type: "string" },
        targetAmount: money,
        savedAmount: money,
        remainingAmount: money,
        monthlyContribution: money,
        targetDate: date,
        forecast: object({
          referenceMonth: month,
          status: {
            type: "string",
            enum: ["REACHED", "NO_DEADLINE", "ON_TRACK", "BEHIND", "MISSED"],
          },
          contributionsNeeded: { ...integer, nullable: true },
          estimatedReachMonth: { ...month, nullable: true },
          requiredMonthlyContribution: { ...money, nullable: true },
        }),
      })
    ),
    projections: object({
      planned: projection,
      maximum: projection,
      reasonable: projection,
    }),
  }),
});
