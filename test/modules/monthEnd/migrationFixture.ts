import { PrismaClient } from "@prisma/client";

/** Test-only rewind, never used by application or production rollback. */
export async function rewindMonthEndMigration(prisma: PrismaClient) {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    process.env.NODE_ENV !== "test" ||
    url.hostname !== "my-happy-wallet-mysql-test" ||
    url.pathname !== "/myhappywallet_test"
  )
    throw Error("Disposable test database required");
  if (await prisma.monthEndDecision.count())
    throw Error("Clean month-end fixtures before migration rehearsal");
  await prisma.$executeRaw`ALTER TABLE SavingsMovement DROP FOREIGN KEY SavingsMovement_monthEndDecisionId_userId_fkey`;
  await prisma.$executeRaw`ALTER TABLE SavingsMovement DROP CHECK SavingsMovement_month_end_metadata, DROP CHECK SavingsMovement_reason_direction`;
  await prisma.$executeRaw`ALTER TABLE SavingsMovement DROP COLUMN isCompensation, DROP COLUMN monthEndRevision, DROP COLUMN monthEndDecisionId`;
  await prisma.$executeRaw`ALTER TABLE SavingsMovement ADD CONSTRAINT SavingsMovement_reason_direction CHECK (
    (reason IN ('MONTH_END', 'GOAL') AND direction = 'TO_SAVINGS') OR
    (reason = 'NEGATIVE_COVERAGE' AND direction = 'FROM_SAVINGS') OR reason = 'MANUAL'
  )`;
  await prisma.$executeRaw`DROP TABLE MonthEndDecisionReceipt`;
  await prisma.$executeRaw`DROP TABLE MonthEndDecision`;
  await prisma.$executeRaw`DELETE FROM _prisma_migrations WHERE migration_name = '20261108211500_add_month_end_decisions'`;
}
