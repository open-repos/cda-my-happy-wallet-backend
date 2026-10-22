import { Prisma, PrismaClient } from "@prisma/client";

/** Aggregate in SQL so totals do not depend on collection pagination. */
export async function loadFixedTotals(
  prisma: Pick<PrismaClient, "$queryRaw">,
  ownerId: number,
  currency?: string
): Promise<{ incomeMinorUnits: number; expenseMinorUnits: number }> {
  const rows = await prisma.$queryRaw<
    { typeOperation: string; total: Prisma.Decimal | null }[]
  >(Prisma.sql`
    SELECT typeOperation, SUM(
      CASE WHEN typeOperation = 'CHARGE' THEN
        ROUND(montant * pourcentagePersonnel / 100 /
          CASE periodicite
            WHEN 'BIMESTRIELLE' THEN 2
            WHEN 'TRIMESTRIELLE' THEN 3
            WHEN 'SEMESTRIELLE' THEN 6
            WHEN 'ANNUELLE' THEN 12
            ELSE 1
          END, 2)
        ELSE montant
      END
    ) AS total
    FROM OperationFixe
    WHERE userId = ${ownerId}
      ${
        currency === undefined
          ? Prisma.empty
          : Prisma.sql`AND devise = ${currency}`
      }
    GROUP BY typeOperation
  `);
  const total = (type: string): number => {
    const amount = rows.find((row) => row.typeOperation === type)?.total;
    // Aggregates may exceed an individual Decimal(10,2) row. Reject unsafe
    // integer totals without applying the per-invoice maximum to the sum.
    if (amount == null) return 0;
    const text = amount.toFixed(2);
    const match = /^(\d+)\.(\d{2})$/.exec(text);
    if (match == null) throw new Error("INVALID_FIXED_TOTAL");
    const units = Number(match[1]) * 100 + Number(match[2]);
    if (!Number.isSafeInteger(units)) throw new Error("INVALID_FIXED_TOTAL");
    return units;
  };
  return {
    incomeMinorUnits: total("REVENU"),
    expenseMinorUnits: total("CHARGE"),
  };
}
