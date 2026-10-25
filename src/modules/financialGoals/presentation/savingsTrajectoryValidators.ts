import { ErrorCode, ErrorException } from "../../../utils/errors";
import { parseScenario } from "../../budgetPeriods/presentation/budgetPeriodValidators";
import { SavingsTrajectoryRequest } from "../application/SavingsTrajectoryService";

const invalid = () =>
  new ErrorException(
    ErrorCode.ValidationFailed,
    "Savings trajectory parameters are invalid"
  );
const amount = (value: unknown): number => {
  if (typeof value !== "string" || !/^(0|[1-9]\d{0,7})\.\d{2}$/.test(value))
    throw invalid();
  const [whole, cents] = value.split(".");
  return Number(whole) * 100 + Number(cents);
};
export const parseSavingsTrajectoryRequest = (
  body: unknown,
  query: Readonly<Record<string, unknown>>
): SavingsTrajectoryRequest => {
  if (
    body === null ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(query).length > 0
  )
    throw invalid();
  const {
    currency,
    scenario,
    months,
    selectedGoalId,
    currentRemainingVariableExpense,
    futureAdditionalVariableExpense,
    monthlySafetyMargin,
    ...unknown
  } = body as Record<string, unknown>;
  if (
    Object.keys(unknown).length > 0 ||
    typeof currency !== "string" ||
    !/^[A-Za-z]{3}$/.test(currency) ||
    typeof months !== "number" ||
    !Number.isInteger(months) ||
    months < 1 ||
    months > 24 ||
    typeof selectedGoalId !== "number" ||
    !Number.isSafeInteger(selectedGoalId) ||
    selectedGoalId < 1
  )
    throw invalid();
  return {
    currency: currency.toUpperCase(),
    scenario: parseScenario(scenario),
    months,
    selectedGoalId,
    currentRemainingVariableExpense: amount(currentRemainingVariableExpense),
    futureAdditionalVariableExpense: amount(futureAdditionalVariableExpense),
    monthlySafetyMargin: amount(monthlySafetyMargin),
  };
};
