/**
 * Agrégat des opérations réelles pour les graphiques. Les dates sont des
 * dates civiles `YYYY-MM-DD`; les montants sont manipulés en centimes entiers.
 */

export type AnalyticsGroupBy =
  | "day"
  | "week"
  | "month"
  | "year"
  | "category"
  | "kind";
export type AnalyticsSplitBy = "category" | "kind";
export type OperationKind = "DEPENSE" | "ENTREE";

export const ANALYTICS_GROUP_BY: readonly AnalyticsGroupBy[] = [
  "day",
  "week",
  "month",
  "year",
  "category",
  "kind",
];
export const ANALYTICS_SPLIT_BY: readonly AnalyticsSplitBy[] = [
  "category",
  "kind",
];
export const OPERATION_KINDS: readonly OperationKind[] = ["DEPENSE", "ENTREE"];
export const TEMPORAL_GROUP_BY: readonly AnalyticsGroupBy[] = [
  "day",
  "week",
  "month",
  "year",
];

/** Nombre maximal de points d'une réponse : seaux × séries. */
export const MAX_ANALYTICS_POINTS = 500;
const MAX_DAYS = 366;
const MAX_WEEKS = 156;
const MAX_MONTHS = 120;
const MAX_YEARS = 30;

export interface AnalyticsQuery {
  from: string;
  to: string;
  currency: string;
  groupBy: AnalyticsGroupBy;
  splitBy: AnalyticsSplitBy | null;
  kind: OperationKind | null;
}

/** Ligne agrégée par la persistance : un total par seau, série et sens. */
export interface AnalyticsRow {
  bucket: string;
  series: string | null;
  kind: OperationKind;
  cents: number;
  count: number;
}

export interface AnalyticsCategory {
  id: number;
  name: string;
  color: string | null;
}

export interface AnalyticsTotals {
  key: string;
  label: string | null;
  color: string | null;
  income: string;
  expense: string;
  net: string;
  count: number;
}

export interface AnalyticsBucket extends AnalyticsTotals {
  series?: AnalyticsTotals[];
}

export interface OperationAnalytics {
  currency: string;
  from: string;
  to: string;
  groupBy: AnalyticsGroupBy;
  splitBy: AnalyticsSplitBy | null;
  kind: OperationKind | null;
  buckets: AnalyticsBucket[];
}

export type OperationAnalyticsErrorCode =
  | "ANALYTICS_RANGE_TOO_LARGE"
  | "ANALYTICS_QUERY_INVALID";

export class OperationAnalyticsError extends Error {
  public constructor(public readonly code: OperationAnalyticsErrorCode) {
    super(code);
    this.name = "OperationAnalyticsError";
  }
}

const DAY_MS = 86400000;
const pad = (value: number) => String(value).padStart(2, "0");
const toTime = (date: string) => Date.parse(`${date}T00:00:00.000Z`);
const toDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/** Lundi de la semaine ISO d'une date civile. */
export const isoWeekStart = (date: string): string => {
  const time = toTime(date);
  const weekday = (new Date(time).getUTCDay() + 6) % 7;
  return toDate(time - weekday * DAY_MS);
};

export const isTemporal = (groupBy: AnalyticsGroupBy): boolean =>
  TEMPORAL_GROUP_BY.includes(groupBy);

/** Toutes les clés temporelles de la période, bornes incluses. */
export const temporalKeys = (query: AnalyticsQuery): string[] => {
  const { from, to } = query;
  switch (query.groupBy) {
    case "day": {
      const keys: string[] = [];
      for (let time = toTime(from); time <= toTime(to); time += DAY_MS) {
        keys.push(toDate(time));
      }
      return keys;
    }
    case "week": {
      const keys: string[] = [];
      const last = toTime(isoWeekStart(to));
      for (
        let time = toTime(isoWeekStart(from));
        time <= last;
        time += 7 * DAY_MS
      ) {
        keys.push(toDate(time));
      }
      return keys;
    }
    case "month": {
      const keys: string[] = [];
      for (let index = monthIndex(from); index <= monthIndex(to); index += 1) {
        keys.push(`${Math.floor(index / 12)}-${pad((index % 12) + 1)}`);
      }
      return keys;
    }
    case "year": {
      const keys: string[] = [];
      for (
        let year = Number(from.slice(0, 4));
        year <= Number(to.slice(0, 4));
        year += 1
      ) {
        keys.push(String(year));
      }
      return keys;
    }
    default:
      return [];
  }
};

/** Refuse une période inversée ou plus large que la granularité ne l'autorise. */
export const validateAnalyticsRange = (query: AnalyticsQuery): void => {
  if (toTime(query.from) > toTime(query.to)) {
    throw new OperationAnalyticsError("ANALYTICS_QUERY_INVALID");
  }
  const months = monthIndex(query.to) - monthIndex(query.from) + 1;
  const limits: Record<AnalyticsGroupBy, boolean> = {
    day: (toTime(query.to) - toTime(query.from)) / DAY_MS + 1 <= MAX_DAYS,
    week:
      (toTime(isoWeekStart(query.to)) - toTime(isoWeekStart(query.from))) /
        (7 * DAY_MS) +
        1 <=
      MAX_WEEKS,
    month: months <= MAX_MONTHS,
    year:
      Number(query.to.slice(0, 4)) - Number(query.from.slice(0, 4)) + 1 <=
      MAX_YEARS,
    category: months <= MAX_MONTHS,
    kind: months <= MAX_MONTHS,
  };
  if (!limits[query.groupBy]) {
    throw new OperationAnalyticsError("ANALYTICS_RANGE_TOO_LARGE");
  }
  // Ventilation par sens : nombre de séries connu avant toute lecture.
  if (query.splitBy === "kind") {
    assertPointBudget(temporalKeys(query).length, query.kind === null ? 2 : 1);
  }
};

export const assertPointBudget = (buckets: number, series: number): void => {
  if (buckets * Math.max(1, series) > MAX_ANALYTICS_POINTS) {
    throw new OperationAnalyticsError("ANALYTICS_RANGE_TOO_LARGE");
  }
};

const amountOf = (cents: number): string => {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)}.${pad(absolute % 100)}`;
};

interface Accumulator {
  income: number;
  expense: number;
  count: number;
}

const emptyAccumulator = (): Accumulator => ({
  income: 0,
  expense: 0,
  count: 0,
});

const add = (target: Accumulator, row: AnalyticsRow) => {
  if (row.kind === "ENTREE") target.income += row.cents;
  else target.expense += row.cents;
  target.count += row.count;
};

const totalsOf = (
  key: string,
  label: string | null,
  color: string | null,
  totals: Accumulator
): AnalyticsTotals => ({
  key,
  label,
  color,
  income: amountOf(totals.income),
  expense: amountOf(totals.expense),
  net: amountOf(totals.income - totals.expense),
  count: totals.count,
});

const describe = (
  dimension: AnalyticsGroupBy | AnalyticsSplitBy,
  key: string,
  categories: Map<string, AnalyticsCategory>
): { label: string | null; color: string | null } => {
  if (dimension !== "category") return { label: null, color: null };
  const category = categories.get(key);
  return { label: category?.name ?? null, color: category?.color ?? null };
};

const kindsOf = (query: AnalyticsQuery): OperationKind[] =>
  query.kind === null ? [...OPERATION_KINDS] : [query.kind];

const volume = (totals: Accumulator) => totals.income + totals.expense;

/**
 * Construit les seaux : clés temporelles complètes avec zéros, types du
 * filtre, ou catégories présentes triées par volume décroissant. Une
 * ventilation ajoute à chaque seau toutes les séries observées.
 */
export const assembleAnalytics = (
  query: AnalyticsQuery,
  rows: readonly AnalyticsRow[],
  categories: readonly AnalyticsCategory[]
): OperationAnalytics => {
  const byCategory = new Map(
    categories.map((category): [string, AnalyticsCategory] => [
      String(category.id),
      category,
    ])
  );
  const buckets = new Map<string, Accumulator>();
  const series = new Map<string, Map<string, Accumulator>>();
  const seriesTotals = new Map<string, Accumulator>();
  for (const row of rows) {
    if (!buckets.has(row.bucket)) buckets.set(row.bucket, emptyAccumulator());
    add(buckets.get(row.bucket)!, row);
    if (query.splitBy !== null && row.series !== null) {
      if (!series.has(row.bucket)) series.set(row.bucket, new Map());
      const bucketSeries = series.get(row.bucket)!;
      if (!bucketSeries.has(row.series)) {
        bucketSeries.set(row.series, emptyAccumulator());
      }
      add(bucketSeries.get(row.series)!, row);
      if (!seriesTotals.has(row.series)) {
        seriesTotals.set(row.series, emptyAccumulator());
      }
      add(seriesTotals.get(row.series)!, row);
    }
  }

  let keys: string[];
  if (isTemporal(query.groupBy)) keys = temporalKeys(query);
  else if (query.groupBy === "kind") keys = kindsOf(query);
  else {
    keys = [...buckets.keys()].sort(
      (left, right) =>
        volume(buckets.get(right)!) - volume(buckets.get(left)!) ||
        Number(left) - Number(right)
    );
  }

  const seriesKeys =
    query.splitBy === "kind"
      ? kindsOf(query).filter((kind) => seriesTotals.has(kind))
      : [...seriesTotals.keys()].sort(
          (left, right) =>
            volume(seriesTotals.get(right)!) -
              volume(seriesTotals.get(left)!) || Number(left) - Number(right)
        );
  // Toujours vérifié : les catégories utilisées ne sont pas plafonnées.
  assertPointBudget(keys.length, seriesKeys.length);

  return {
    currency: query.currency,
    from: query.from,
    to: query.to,
    groupBy: query.groupBy,
    splitBy: query.splitBy,
    kind: query.kind,
    buckets: keys.map((key) => {
      const { label, color } = describe(query.groupBy, key, byCategory);
      const bucket: AnalyticsBucket = totalsOf(
        key,
        label,
        color,
        buckets.get(key) ?? emptyAccumulator()
      );
      if (query.splitBy !== null) {
        const splitBy = query.splitBy;
        bucket.series = seriesKeys.map((serieKey) => {
          const description = describe(splitBy, serieKey, byCategory);
          return totalsOf(
            serieKey,
            description.label,
            description.color,
            series.get(key)?.get(serieKey) ?? emptyAccumulator()
          );
        });
      }
      return bucket;
    }),
  };
};
