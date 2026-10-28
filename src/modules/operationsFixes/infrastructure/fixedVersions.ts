import { Prisma, PrismaClient, FixedChargePeriodicity } from "@prisma/client";
import { parisCivilDateClock } from "../../../utils/civilDateClock";
import {
  ReconciliationError,
  inputAmount,
} from "../../reconciliation/domain/Reconciliation";
import { lockReconciliationOwner } from "../../reconciliation/infrastructure/reconciliationLocks";
import {
  personalChargeMinorUnits,
  decimalHundredths,
  decimalAmount,
} from "../services/fixedChargeAmounts";
import { monthBounds } from "../../budgetPeriods/domain/BudgetPeriod";

type Client = PrismaClient | Prisma.TransactionClient;
export type FixedSnapshot = {
  titre: string;
  montant: string;
  devise: string | null;
  periodicite: FixedChargePeriodicity;
  pourcentagePersonnel: string;
  categoryId: number | null;
  category: Prisma.JsonValue | null;
  isBudgetEnvelope: boolean;
  budgetStartMonth: string | null;
  budgetEndMonth: string | null;
  budgetArchived: boolean;
};
export const monthDate = (month: string) =>
  new Date(`${monthBounds(month).start}T00:00:00Z`);
export const fixedCategorySelect = {
  id: true,
  name: true,
  color: true,
  icon: true,
  fixedKind: true,
} as const;
export const snapshotOf = (row: any): FixedSnapshot => ({
  titre: row.titre,
  montant: new Prisma.Decimal(row.montant).toFixed(2),
  devise: row.devise,
  periodicite: row.periodicite ?? "MENSUELLE",
  pourcentagePersonnel: String(row.pourcentagePersonnel ?? 100),
  categoryId: row.categoryId ?? null,
  category: row.category ?? null,
  isBudgetEnvelope: row.isBudgetEnvelope ?? false,
  budgetStartMonth:
    row.budgetStartMonth instanceof Date
      ? row.budgetStartMonth.toISOString().slice(0, 7)
      : row.budgetStartMonth ?? null,
  budgetEndMonth:
    row.budgetEndMonth instanceof Date
      ? row.budgetEndMonth.toISOString().slice(0, 7)
      : row.budgetEndMonth ?? null,
  budgetArchived: row.budgetArchived ?? false,
});
export const resolvedFixedRow = (row: any) => {
  const version = row.versions?.[0];
  return version ? { ...row, ...(version.payload as FixedSnapshot) } : row;
};
export async function effectiveFixedRows(
  db: Client,
  owner: number,
  month: string
) {
  const rows = await db.operationFixe.findMany({
    where: { userId: owner },
    include: {
      category: { select: fixedCategorySelect },
      versions: {
        where: { effectiveMonth: { lte: monthDate(month) } },
        orderBy: { effectiveMonth: "desc" },
        take: 1,
      },
    },
  });
  return rows.map(resolvedFixedRow).filter((row) => {
    const snapshot = snapshotOf(row);
    return (
      !snapshot.budgetArchived &&
      (!snapshot.budgetStartMonth || snapshot.budgetStartMonth <= month) &&
      (!snapshot.budgetEndMonth || snapshot.budgetEndMonth >= month)
    );
  });
}
export function assertEnvelopeFlag(
  flag: boolean,
  type: string,
  periodicity: string
) {
  if (flag && (type !== "CHARGE" || periodicity !== "MENSUELLE"))
    throw new ReconciliationError("INVALID_BUDGET_ENVELOPE");
}

/** Dated writes do not change the canonical row until their effective month. */
export async function scheduleFixedVersion(
  db: PrismaClient,
  owner: number,
  id: number,
  type: string,
  input: Partial<FixedSnapshot> & { effectiveMonth?: string },
  today = parisCivilDateClock()
) {
  const month = input.effectiveMonth ?? today.slice(0, 7);
  monthBounds(month);
  const gap =
    (Number(month.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    Number(month.slice(5)) -
    Number(today.slice(5, 7));
  if (gap < 0 || gap > 23)
    throw new ReconciliationError("INVALID_EFFECTIVE_MONTH");
  return db.$transaction(async (tx) => {
    await lockReconciliationOwner(tx, owner);
    const row = await tx.operationFixe.findFirst({
      where: {
        idOperationFixe: id,
        userId: owner,
        typeOperation: type as "CHARGE" | "REVENU",
      },
      include: {
        category: { select: fixedCategorySelect },
        versions: {
          where: { effectiveMonth: { lte: monthDate(month) } },
          orderBy: { effectiveMonth: "desc" },
          take: 1,
        },
      },
    });
    if (!row) throw new ReconciliationError("NOT_FOUND");
    const { effectiveMonth: _, ...changes } = input;
    void _;
    const payload = { ...snapshotOf(resolvedFixedRow(row)), ...changes };
    if (input.categoryId !== undefined) {
      const category =
        input.categoryId === null
          ? null
          : await tx.operationCategory.findFirst({
              where: { id: input.categoryId, userId: owner },
              select: fixedCategorySelect,
            });
      if (
        input.categoryId !== null &&
        (!category ||
          (category.fixedKind !== null && category.fixedKind !== type))
      )
        throw new ReconciliationError("INVALID_CATEGORY");
      payload.category = category;
    }
    payload.montant = inputAmount(payload.montant);
    if (decimalHundredths(payload.pourcentagePersonnel) > 10000)
      throw new ReconciliationError("INVALID_AMOUNT");
    if (payload.devise !== null) {
      payload.devise = payload.devise.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(payload.devise))
        throw new ReconciliationError("INVALID_CURRENCY");
    }
    assertEnvelopeFlag(payload.isBudgetEnvelope, type, payload.periodicite);
    // Preserve the pre-edit definition for every earlier period; create once.
    await tx.fixedOperationVersion.upsert({
      where: {
        operationId_effectiveMonth: {
          operationId: id,
          effectiveMonth: monthDate("1970-01"),
        },
      },
      create: {
        operationId: id,
        userId: owner,
        effectiveMonth: monthDate("1970-01"),
        payload: snapshotOf(row),
      },
      update: {},
    });
    await tx.fixedOperationVersion.upsert({
      where: {
        operationId_effectiveMonth: {
          operationId: id,
          effectiveMonth: monthDate(month),
        },
      },
      create: {
        operationId: id,
        userId: owner,
        effectiveMonth: monthDate(month),
        payload,
      },
      update: { payload },
    });
    // Explicit dated edits update only open snapshots from their effective month.
    const [versions, occurrences, closed] = await Promise.all([
      tx.fixedOperationVersion.findMany({
        where: { operationId: id, userId: owner },
        orderBy: { effectiveMonth: "desc" },
      }),
      tx.reconciliationOccurrence.findMany({
        where: {
          userId: owner,
          fixedSourceId: id,
          month: { gte: monthDate(month) },
        },
        include: { _count: { select: { links: true } } },
      }),
      tx.budgetPeriod.findMany({
        where: {
          userId: owner,
          status: "CLOSED",
          periodStart: { gte: monthDate(month) },
        },
        select: { periodStart: true, currency: true },
      }),
    ]);
    for (const occurrence of occurrences) {
      if (
        closed.some(
          (p) =>
            p.currency === occurrence.currency &&
            p.periodStart.getTime() === occurrence.month.getTime()
        )
      )
        continue;
      const applicable = versions.find(
        (v) => v.effectiveMonth <= occurrence.month
      )!.payload as unknown as FixedSnapshot;
      const occurrenceMonth = occurrence.month.toISOString().slice(0, 7);
      const active =
        (!applicable.budgetStartMonth ||
          applicable.budgetStartMonth <= occurrenceMonth) &&
        (!applicable.budgetEndMonth ||
          applicable.budgetEndMonth >= occurrenceMonth) &&
        applicable.isBudgetEnvelope &&
        applicable.periodicite === "MENSUELLE" &&
        !applicable.budgetArchived;
      if (!active) {
        if (occurrence._count.links > 0)
          throw new ReconciliationError("ENVELOPE_IN_USE");
        await tx.reconciliationOccurrence.delete({
          where: { id: occurrence.id },
        });
      } else {
        if (
          occurrence._count.links > 0 &&
          applicable.devise !== occurrence.currency
        )
          throw new ReconciliationError("CURRENCY_MISMATCH");
        await tx.reconciliationOccurrence.update({
          where: { id: occurrence.id },
          data: {
            title: applicable.titre,
            referenceTotal: applicable.montant,
            personalShare: applicable.pourcentagePersonnel,
            currency: applicable.devise!,
            categoryId: applicable.categoryId,
            planned: decimalAmount(personalChargeMinorUnits(applicable)),
          },
        });
      }
    }
    return { count: 1 };
  });
}
