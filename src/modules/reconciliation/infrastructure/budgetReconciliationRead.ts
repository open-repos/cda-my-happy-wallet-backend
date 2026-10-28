import { Prisma, PrismaClient } from "@prisma/client";
import { cents, safe } from "../domain/Reconciliation";
import { personalChargeMinorUnits } from "../../operationsFixes/services/fixedChargeAmounts";
import { effectiveFixedRows } from "../../operationsFixes/infrastructure/fixedVersions";
import { monthBounds } from "../../budgetPeriods/domain/BudgetPeriod";

type Client = PrismaClient | Prisma.TransactionClient;
const date = (month: string) =>
  new Date(`${monthBounds(month).start}T00:00:00Z`);

/** Snapshot overrides apply only to materialized fixed sources in that month. */
export async function reconcileFixedTotals(
  db: Client,
  owner: number,
  currency: string,
  month: string,
  raw: { incomeMinorUnits: number; expenseMinorUnits: number }
) {
  const occurrences = await db.reconciliationOccurrence.findMany({
    where: {
      userId: owner,
      month: date(month),
      currency,
      fixedSourceId: { not: null },
    },
  });
  if (!occurrences.length) return raw;
  const fixed = (await effectiveFixedRows(db, owner, month)).filter(
    (row) => row.devise?.toUpperCase() === currency
  );
  let { incomeMinorUnits, expenseMinorUnits } = raw;
  for (const occurrence of occurrences) {
    const source = fixed.find(
      (f) => f.idOperationFixe === occurrence.fixedSourceId
    );
    const oldAmount = source
      ? source.typeOperation === "CHARGE"
        ? personalChargeMinorUnits(source)
        : cents(String(source.montant))
      : 0;
    if (source?.typeOperation === "CHARGE") expenseMinorUnits -= oldAmount;
    else if (source) incomeMinorUnits -= oldAmount;
    if (occurrence.kind === "DEPENSE")
      expenseMinorUnits += cents(occurrence.planned.toFixed(2));
    else incomeMinorUnits += cents(occurrence.planned.toFixed(2));
  }
  return {
    incomeMinorUnits: safe(incomeMinorUnits),
    expenseMinorUnits: safe(expenseMinorUnits),
  };
}

/** Opted-in envelopes are fixed costs already included in the monthly base. */
export async function envelopeReserve(
  _db: Client,
  _owner: number,
  _month: string,
  _currency: string
): Promise<number> {
  return 0;
}
