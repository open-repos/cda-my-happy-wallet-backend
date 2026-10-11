import { ErrorCode, ErrorException } from "../../../utils/errors";
import {
  ANALYTICS_GROUP_BY,
  ANALYTICS_SPLIT_BY,
  AnalyticsGroupBy,
  AnalyticsQuery,
  AnalyticsSplitBy,
  OPERATION_KINDS,
  OperationKind,
  isTemporal,
} from "../domain";

const ALLOWED = ["from", "to", "currency", "groupBy", "splitBy", "kind"];

const invalid = (message: string) =>
  new ErrorException(ErrorCode.ValidationFailed, message);

const parseDate = (value: unknown, name: string): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw invalid(`${name} parameter is invalid`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw invalid(`${name} parameter is invalid`);
  }
  return value;
};

const parseOne = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  name: string
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw invalid(`${name} parameter is invalid`);
  }
  return value as T;
};

/** Paramètres de `GET /analytics/operations`; tout paramètre inconnu est refusé. */
export const parseAnalyticsRequest = (
  query: Readonly<Record<string, unknown>>
): AnalyticsQuery => {
  if (Object.keys(query).some((key) => !ALLOWED.includes(key))) {
    throw invalid("Analytics parameters are invalid");
  }
  if (
    typeof query.currency !== "string" ||
    !/^[A-Za-z]{3}$/.test(query.currency)
  ) {
    throw invalid("Currency parameter is invalid");
  }
  const groupBy = parseOne<AnalyticsGroupBy>(
    query.groupBy,
    ANALYTICS_GROUP_BY,
    "groupBy"
  );
  const splitBy =
    query.splitBy === undefined
      ? null
      : parseOne<AnalyticsSplitBy>(
          query.splitBy,
          ANALYTICS_SPLIT_BY,
          "splitBy"
        );
  if (splitBy !== null && !isTemporal(groupBy)) {
    throw invalid("splitBy requires a time grouping");
  }
  return {
    from: parseDate(query.from, "from"),
    to: parseDate(query.to, "to"),
    currency: query.currency.toUpperCase(),
    groupBy,
    splitBy,
    kind:
      query.kind === undefined
        ? null
        : parseOne<OperationKind>(query.kind, OPERATION_KINDS, "kind"),
  };
};
