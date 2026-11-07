import { Prisma, PrismaClient } from "@prisma/client";

/** At most one virtual occurrence per linked account/month. Reads never write. */
export function plannedSavingsWhere(
  owner: number,
  month: string,
  currency: string
) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const end = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  );
  return Prisma.sql`
    FROM SavingsAccount a
    JOIN SavingsGoalLink l ON l.accountId = a.id AND l.userId = a.userId
    JOIN ObjectifFinancier g ON g.id = l.goalId AND g.userId = a.userId
    LEFT JOIN SavingsOccurrenceResolution r ON r.userId = a.userId
      AND r.accountId = a.id AND r.month = ${start}
    WHERE a.userId = ${owner} AND a.currency = ${currency} AND a.archived = FALSE
      AND g.devise = a.currency AND l.linkedOn <= ${end} AND r.id IS NULL
      AND g.monthlyContribution > 0 AND a.balanceMinorUnits < g.montant * 100
  `;
}

export async function plannedSavingsMovements(
  prisma: PrismaClient | Prisma.TransactionClient,
  owner: number,
  month: string,
  currency: string
) {
  const start = new Date(`${month}-01T00:00:00Z`);
  const rows = await prisma.$queryRaw<
    { occurrenceDate: Date; total: Prisma.Decimal; occurrences: bigint }[]
  >(Prisma.sql`
    SELECT GREATEST(l.linkedOn, ${start}) AS occurrenceDate,
      SUM(g.monthlyContribution * 100) AS total, COUNT(*) AS occurrences
    ${plannedSavingsWhere(owner, month, currency)}
    GROUP BY occurrenceDate ORDER BY occurrenceDate
  `);
  return rows.map((row) => ({
    occurrenceDate: row.occurrenceDate.toISOString().slice(0, 10),
    kind: "DEPENSE" as const,
    minorUnits: Number(row.total),
    savingsMinorUnits: Number(row.total),
    count: Number(row.occurrences),
  }));
}
