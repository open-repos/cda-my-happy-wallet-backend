import { effectiveFixedRows } from "../../operationsFixes/infrastructure/fixedVersions";
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

/** Shared by operation-save and standalone link endpoints; caller owns the user lock. */
export async function applyReconciliationLink(
  tx: Prisma.TransactionClient,
  owner: number,
  operationId: number,
  occurrenceId: number | null,
  expectedOccurrenceId: number | null,
  today: string
) {
  const operation = await tx.oneOffOperationRecord.findFirst({
    where: { id: operationId, userId: owner },
    include: { reconciliation: true },
  });
  if (!operation) throw new ReconciliationError("NOT_FOUND");
  const find = async (id: number) => {
    const row = await tx.reconciliationOccurrence.findFirst({
      where: { id, userId: owner },
    });
    if (!row) throw new ReconciliationError("NOT_FOUND");
    return row;
  };
  const current = operation.reconciliation?.occurrenceId ?? null;
  const destination = occurrenceId === null ? null : await find(occurrenceId);
  if (current !== expectedOccurrenceId && current !== occurrenceId)
    throw new ReconciliationError("ASSOCIATION_CONFLICT");
  if (current === occurrenceId) {
    // Save callers may have changed the payment. Even a link replay validates it.
    if (destination)
      assertCompatible(
        {
          month: destination.month.toISOString().slice(0, 7),
          currency: destination.currency,
          kind: destination.kind,
        },
        {
          operationDate: operation.operationDate.toISOString().slice(0, 10),
          currency: operation.currency,
          kind: operation.type,
        }
      );
    return;
  }
  if (current !== null) {
    const previous = await find(current);
    await assertOpen(
      tx,
      owner,
      previous.month.toISOString().slice(0, 7),
      previous.currency,
      today
    );
  }
  if (destination) {
    const source = (
      await effectiveFixedRows(
        tx,
        owner,
        destination.month.toISOString().slice(0, 7)
      )
    ).find((row) => row.idOperationFixe === destination.fixedSourceId);
    if (
      destination.sourceType !== "ENVELOPE" ||
      !source?.isBudgetEnvelope ||
      source.typeOperation !== "CHARGE" ||
      source.periodicite !== "MENSUELLE"
    )
      throw new ReconciliationError("NOT_BUDGET_ENVELOPE");
    await assertOpen(
      tx,
      owner,
      destination.month.toISOString().slice(0, 7),
      destination.currency,
      today
    );
    assertCompatible(
      {
        month: destination.month.toISOString().slice(0, 7),
        currency: destination.currency,
        kind: destination.kind,
      },
      {
        operationDate: operation.operationDate.toISOString().slice(0, 10),
        currency: operation.currency,
        kind: operation.type,
      }
    );
    await tx.reconciliationLink.upsert({
      where: { operationId },
      create: { operationId, userId: owner, occurrenceId: destination.id },
      update: { occurrenceId: destination.id },
    });
  } else
    await tx.reconciliationLink.deleteMany({
      where: { operationId, userId: owner },
    });
}
