import { cents, money, safe } from "./Reconciliation";
export type EnvelopeMonth = {
  month: string;
  planned: string;
  actual: string;
  operationCount: number;
};
const signedMoney = (value: number) =>
  value < 0 ? `-${money(-value)}` : money(value);
const roundedMean = (value: number, count: number) =>
  Number((BigInt(value) + BigInt(Math.floor(count / 2))) / BigInt(count));
/** Missing reconciliation is not an observed zero. Current/future months never enter the mean. */
export function analyzeEnvelopeMonths(
  months: readonly EnvelopeMonth[],
  currentMonth: string
) {
  const completed = months.filter((m) => m.month < currentMonth);
  const sample = completed.filter((m) => m.operationCount > 0);
  let actual = 0,
    planned = 0,
    positiveOverrun = 0,
    exceeded = 0;
  for (const month of sample) {
    const a = cents(month.actual),
      p = cents(month.planned);
    actual = safe(actual + a);
    planned = safe(planned + p);
    positiveOverrun = safe(positiveOverrun + Math.max(a - p, 0));
    if (a > p) exceeded++;
  }
  const count = sample.length;
  return {
    sampleMonths: count,
    completedMonthsObserved: completed.length,
    unreconciledMonthsExcluded: completed.length - count,
    incompleteMonthsExcluded: months.length - completed.length,
    meanActual: count ? money(roundedMean(actual, count)) : null,
    meanPlanned: count ? money(roundedMean(planned, count)) : null,
    meanVariance: count
      ? signedMoney(
          (actual >= planned ? 1 : -1) *
            roundedMean(Math.abs(actual - planned), count)
        )
      : null,
    meanOverrun: count ? money(roundedMean(positiveOverrun, count)) : null,
    exceededMonths: exceeded,
    overrunRate: count ? Math.round((exceeded * 10000) / count) / 100 : null,
    samplePolicy: "COMPLETED_MONTHS_WITH_LINKED_OPERATIONS" as const,
  };
}
