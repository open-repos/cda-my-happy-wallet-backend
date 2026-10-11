import { ErrorCode, ErrorException } from "../../../utils/errors";
import { PaginationRequest, parsePaginationRequest } from "../../pagination";

const invalid = (message: string) =>
  new ErrorException(ErrorCode.ValidationFailed, message);

const parseCurrency = (value: unknown): string => {
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) {
    throw invalid("Currency parameter is invalid");
  }
  return value.toUpperCase();
};

export const parseSummaryRequest = (
  month: string,
  query: Readonly<Record<string, unknown>>
): { month: string; currency: string } => {
  if (Object.keys(query).some((key) => key !== "currency")) {
    throw invalid("Summary parameters are invalid");
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw invalid("Month parameter is invalid");
  }
  return { month, currency: parseCurrency(query.currency) };
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
