import { ErrorCode, ErrorException } from "../../../utils/errors";
import { PaginationRequest, parsePaginationRequest } from "../../pagination";
import { BudgetScenario } from "../../monthlyEvents/domain";

const invalid = (message: string) =>
  new ErrorException(ErrorCode.ValidationFailed, message);

export const parseScenario = (value: unknown): BudgetScenario => {
  if (value === undefined || value === "standard") return "standard";
  if (value === "simulation") return "simulation";
  throw invalid("Scenario parameter is invalid");
};

const parseCurrency = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) {
    throw invalid("Currency parameter is invalid");
  }
  return value.toUpperCase();
};

export const parseSummaryRequest = (
  month: string,
  query: Readonly<Record<string, unknown>>
): { month: string; currency: string; scenario: BudgetScenario } => {
  if (
    Object.keys(query).some((key) => key !== "currency" && key !== "scenario")
  ) {
    throw invalid("Summary parameters are invalid");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw invalid("Month parameter is invalid");
  }
  return {
    month,
    currency: parseCurrency(query.currency),
    scenario: parseScenario(query.scenario),
  };
};

export const parseHistoryRequest = (
  query: Readonly<Record<string, unknown>>
): { currency: string; pagination: PaginationRequest } => {
  const { currency, ...pagination } = query;
  return {
    currency: parseCurrency(currency),
    pagination: parsePaginationRequest(pagination),
  };
};

export const parseForecastRequest = (
  query: Readonly<Record<string, unknown>>
): {
  from: string;
  months: number;
  currency: string;
  scenario: BudgetScenario;
} => {
  const { from, months, currency, scenario, ...unknown } = query;
  if (
    Object.keys(unknown).length > 0 ||
    typeof from !== "string" ||
    (months !== undefined &&
      (typeof months !== "string" || !/^(?:[1-9]|1\d|2[0-4])$/.test(months)))
  ) {
    throw invalid("Forecast parameters are invalid");
  }
  const summary = parseSummaryRequest(from, { currency });
  return {
    from: summary.month,
    months: months === undefined ? 12 : Number(months),
    currency: summary.currency,
    scenario: parseScenario(scenario),
  };
};
