import { Prisma } from "@prisma/client";
import {
  ReconciliationError,
  assertCompatible,
} from "../domain/Reconciliation";
import { parisCivilDateClock } from "../../../utils/civilDateClock";

export async function lockReconciliationOwner(
  tx: Prisma.TransactionClient,
  owner: number
) {
  const rows = await tx.$queryRaw<{ id: number }[]>(
    Prisma.sql`SELECT id FROM Utilisateur WHERE id = ${owner} FOR UPDATE`
  );
  if (!rows.length) throw new ReconciliationError("NOT_FOUND");
}
export async function periodClosed(
  tx: Prisma.TransactionClient,
  owner: number,
  month: string,
  currency: string,
  today: string
) {
  const rows = await tx.$queryRaw<{ status: string }[]>(Prisma.sql`
    SELECT status FROM BudgetPeriod WHERE userId = ${owner}
    AND periodStart = ${new Date(
      `${month}-01T00:00:00Z`
    )} AND currency = ${currency} FOR UPDATE`);
  return month < today.slice(0, 7) || rows[0]?.status === "CLOSED";
}
export async function assertOpen(
  tx: Prisma.TransactionClient,
  owner: number,
  month: string,
  currency: string,
  today: string
) {
  if (await periodClosed(tx, owner, month, currency, today))
    throw new ReconciliationError("PERIOD_CLOSED");
}

/** Called inside the operation mutation transaction under the same owner lock as linking. */
export async function guardLinkedOperation(
  tx: Prisma.TransactionClient,
  owner: number,
  operationId: number,
  replacement?: {
    operationDate: string;
    currency: string;
    kind: "DEPENSE" | "ENTREE";
  },
  today: string = parisCivilDateClock()
) {
  const link = await tx.reconciliationLink.findFirst({
    where: { operationId, userId: owner },
    include: { occurrence: true },
  });
  if (!link) return;
  const occurrence = link.occurrence;
  const month = occurrence.month.toISOString().slice(0, 7);
  await assertOpen(tx, owner, month, occurrence.currency, today);
  if (replacement) {
    try {
      assertCompatible(
        { month, currency: occurrence.currency, kind: occurrence.kind },
        replacement
      );
    } catch {
      throw new ReconciliationError("LINKED_OPERATION_INCOMPATIBLE");
    }
  }
}
