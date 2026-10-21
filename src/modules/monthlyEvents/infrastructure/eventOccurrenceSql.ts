import { Prisma } from "@prisma/client";

/** Bounded civil-date series: a month (31 rows), or the pending window (366). */
export const occurrenceDatesSql = (
  from: string,
  through: string | Prisma.Sql
): Prisma.Sql => Prisma.sql`
  WITH RECURSIVE occurrence_dates (occurrenceDate) AS (
    SELECT STR_TO_DATE(${from}, '%Y-%m-%d')
    UNION ALL
    SELECT DATE_ADD(occurrenceDate, INTERVAL 1 DAY) FROM occurrence_dates
    WHERE occurrenceDate < ${
      typeof through === "string"
        ? Prisma.sql`STR_TO_DATE(${through}, '%Y-%m-%d')`
        : through
    }
  )`;

/** All callers use the fixed e/d aliases; external input is always bound. */
export const matchesOccurrenceSql = Prisma.sql`
  e.startDate <= d.occurrenceDate
  AND (e.endDate IS NULL OR d.occurrenceDate <= e.endDate)
  AND (
    (e.recurrence = 'AUCUNE' AND e.startDate = d.occurrenceDate)
    OR (e.recurrence = 'HEBDOMADAIRE' AND MOD(DATEDIFF(d.occurrenceDate, e.startDate), 7) = 0)
    OR (
      DAY(d.occurrenceDate) = LEAST(DAY(e.startDate), DAY(LAST_DAY(d.occurrenceDate)))
      AND (
        e.recurrence = 'MENSUELLE'
        OR (e.recurrence = 'TRIMESTRIELLE' AND MOD(PERIOD_DIFF(DATE_FORMAT(d.occurrenceDate, '%Y%m'), DATE_FORMAT(e.startDate, '%Y%m')), 3) = 0)
        OR (e.recurrence = 'ANNUELLE' AND MOD(PERIOD_DIFF(DATE_FORMAT(d.occurrenceDate, '%Y%m'), DATE_FORMAT(e.startDate, '%Y%m')), 12) = 0)
      )
    )
  )`;
