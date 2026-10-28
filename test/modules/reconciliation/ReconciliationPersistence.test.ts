import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaReconciliationRepository } from "../../../src/modules/reconciliation/infrastructure/PrismaReconciliationRepository";
import { PrismaEnvelopeReporting } from "../../../src/modules/reconciliation/infrastructure/PrismaEnvelopeReporting";
import {
  scheduleFixedVersion,
  effectiveFixedRows,
} from "../../../src/modules/operationsFixes/infrastructure/fixedVersions";
import { PrismaBudgetPeriodRepository } from "../../../src/modules/budgetPeriods/infrastructure";
import { BudgetPeriodEngine } from "../../../src/modules/budgetPeriods/application";
import { ReconciliationError } from "../../../src/modules/reconciliation/domain/Reconciliation";
const url = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
if (
  process.env.NODE_ENV !== "test" ||
  url.hostname !== "my-happy-wallet-mysql-test" ||
  url.pathname !== "/myhappywallet_test"
)
  throw new Error("Disposable MySQL required");
const db = new PrismaClient();
const emails = ["recon-opt-in@example.test", "recon-opt-other@example.test"];
const page = { limit: 100, cursor: null };
const error = (code: string) => (e: unknown) =>
  e instanceof ReconciliationError && e.code === code;
async function clean() {
  const users = await db.utilisateur.findMany({
    where: { email: { in: emails } },
  });
  const userId = { in: users.map((u) => u.id) };
  await db.reconciliationLink.deleteMany({ where: { userId } });
  await db.reconciliationOccurrence.deleteMany({ where: { userId } });
  await db.budgetEnvelope.deleteMany({ where: { userId } });
  await db.operationFixe.deleteMany({ where: { userId } });
  await db.utilisateur.deleteMany({ where: { id: userId } });
}
async function run() {
  await clean();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      db.utilisateur.create({
        data: {
          email,
          firstname: "Test",
          lastname: "Opt-in",
          password: "test-only",
        },
      })
    )
  );
  const category = await db.operationCategory.create({
    data: { userId: owner.id, name: "Alimentation" },
  });
  const foreignCategory = await db.operationCategory.create({
    data: { userId: other.id, name: "Privé" },
  });
  let today = "2026-09-15";
  const clock = () => today;
  const recon = new PrismaReconciliationRepository(db, clock),
    reports = new PrismaEnvelopeReporting(db, clock);
  const input = {
    title: "Courses",
    amount: "300.00",
    currency: "EUR",
    categoryId: category.id,
    startMonth: "2026-09",
    endMonth: null,
  };
  const envelope = await recon.saveEnvelope(owner.id, input);
  const row = await db.operationFixe.findUniqueOrThrow({
    where: { idOperationFixe: envelope.id },
  });
  assert.strictEqual(row.isBudgetEnvelope, true);
  assert.strictEqual(
    await db.budgetEnvelope.count({ where: { userId: owner.id } }),
    0
  ); // no duplicate independent definition
  await assert.rejects(
    recon.saveEnvelope(owner.id, { ...input, categoryId: foreignCategory.id }),
    error("NOT_FOUND")
  );
  const ordinary = await db.operationFixe.create({
    data: { userId: owner.id, titre: "Loyer", montant: "800", devise: "EUR" },
  });
  const income = await db.operationFixe.create({
    data: {
      userId: owner.id,
      titre: "Salaire",
      montant: "2000",
      devise: "EUR",
      typeOperation: "REVENU",
    },
  });
  const annual = await db.operationFixe.create({
    data: {
      userId: owner.id,
      titre: "Assurance",
      montant: "120",
      devise: "EUR",
      periodicite: "ANNUELLE",
    },
  });
  let occurrences = (
    await recon.listOccurrences(owner.id, "2026-09", "EUR", page)
  ).data;
  assert.strictEqual(occurrences.length, 1);
  const september = occurrences[0];
  assert.strictEqual(september.sourceType, "ENVELOPE");
  const real = async (amount: string, operationDate: string, extra = {}) =>
    db.oneOffOperationRecord.create({
      data: {
        userId: owner.id,
        title: "Courses",
        amount,
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date(`${operationDate}T00:00:00Z`),
        categoryId: category.id,
        ...extra,
      },
    });
  const purchases = await Promise.all(
    ["85", "42", "96", "110"].map((a) => real(a, "2026-09-10"))
  );
  for (const purchase of purchases.slice(0, 3))
    await recon.link(owner.id, purchase.id, september.id, null);
  let metrics = (await recon.getOccurrence(owner.id, september.id)).metrics;
  assert.strictEqual(metrics.actual, "223.00");
  assert.strictEqual(metrics.remaining, "77.00");
  assert.strictEqual(metrics.progress, 74.33);
  await Promise.all([
    recon.link(owner.id, purchases[3].id, september.id, null),
    recon.link(owner.id, purchases[3].id, september.id, null),
  ]);
  metrics = (await recon.getOccurrence(owner.id, september.id)).metrics;
  assert.strictEqual(metrics.overrun, "33.00");
  assert.strictEqual(metrics.projected, "333.00");
  const eligibility = (await recon.eligibility(owner.id, page)).data;
  assert.strictEqual(
    eligibility.find((r) => r.id === ordinary.idOperationFixe)!.reason,
    "NOT_BUDGET_ENVELOPE"
  );
  assert.strictEqual(
    eligibility.find((r) => r.id === income.idOperationFixe)!.reason,
    "INCOME_NOT_ELIGIBLE"
  );
  assert.strictEqual(
    eligibility.find((r) => r.id === annual.idOperationFixe)!.eligible,
    false
  );
  const second = await recon.saveEnvelope(owner.id, {
    ...input,
    title: "Autres courses",
  });
  occurrences = (await recon.listOccurrences(owner.id, "2026-09", "EUR", page))
    .data;
  const secondMonth = occurrences.find((r) => r.sourceId === second.id)!;
  const unlinked = await real("10", "2026-09-12");
  assert.strictEqual(
    (await recon.suggestions(owner.id, unlinked.id, page)).data.length,
    2
  );
  assert.strictEqual(
    (await recon.getLink(owner.id, unlinked.id)).occurrenceId,
    null
  );
  const race = await Promise.allSettled([
    recon.link(owner.id, unlinked.id, september.id, null),
    recon.link(owner.id, unlinked.id, secondMonth.id, null),
  ]);
  assert.strictEqual(race.filter((r) => r.status === "fulfilled").length, 1);
  const current = (await recon.getLink(owner.id, unlinked.id)).occurrenceId!;
  await recon.link(owner.id, unlinked.id, null, current);
  await assert.rejects(
    recon.getOccurrence(other.id, september.id),
    error("NOT_FOUND")
  );
  await assert.rejects(
    recon.link(other.id, unlinked.id, september.id, null),
    error("NOT_FOUND")
  );
  for (const [extra, code] of [
    [{ currency: "USD" }, "CURRENCY_MISMATCH"],
    [{ type: "ENTREE" as const }, "TYPE_MISMATCH"],
    [{ operationDate: new Date("2026-10-10T00:00:00Z") }, "PERIOD_MISMATCH"],
  ] as const) {
    const invalid = await real("1", "2026-09-10", extra);
    await assert.rejects(
      recon.link(owner.id, invalid.id, september.id, null),
      error(code)
    );
  }
  const first = await recon.listOperations(owner.id, september.id, false, {
    limit: 1,
    cursor: null,
  });
  assert.ok(first.meta.nextCursor);
  assert.notStrictEqual(
    (
      await recon.listOperations(owner.id, september.id, false, {
        limit: 1,
        cursor: first.meta.nextCursor,
      })
    ).data[0].id,
    first.data[0].id
  );
  await assert.rejects(
    recon.listOperations(owner.id, september.id, true, {
      limit: 1,
      cursor: first.meta.nextCursor,
    })
  );
  const overview = await reports.overview(
    owner.id,
    { from: "2026-09", to: "2026-09", currency: "EUR" },
    page
  );
  const seen = overview.data.find((r) => r.id === envelope.id)!;
  const months = seen.months as any[];
  assert.strictEqual(months[0].actual, "333.00");
  assert.strictEqual(months[0].paymentsPreview.length, 3);
  assert.strictEqual(months[0].operationCount, 4);
  assert.strictEqual((seen.statistics as any).sampleMonths, 0); // current month excluded
  today = "2026-10-15";
  const october = (
    await recon.listOccurrences(owner.id, "2026-10", "EUR", page)
  ).data.find((r) => r.sourceId === envelope.id)!;
  await scheduleFixedVersion(
    db,
    owner.id,
    envelope.id,
    "CHARGE",
    { montant: "350", effectiveMonth: "2026-11" },
    today
  );
  assert.strictEqual(
    (await effectiveFixedRows(db, owner.id, "2026-10"))
      .find((r) => r.idOperationFixe === envelope.id)!
      .montant.toString(),
    "300.00"
  );
  const november = (
    await recon.listOccurrences(owner.id, "2026-11", "EUR", page)
  ).data.find((r) => r.sourceId === envelope.id)!;
  assert.strictEqual(november.metrics.planned, "350.00");
  // An already materialized future month is updated by an explicit dated edit.
  await scheduleFixedVersion(
    db,
    owner.id,
    envelope.id,
    "CHARGE",
    { montant: "400", effectiveMonth: "2026-11" },
    today
  );
  assert.strictEqual(
    (await recon.getOccurrence(owner.id, november.id)).metrics.planned,
    "400.00"
  );
  assert.strictEqual(
    (await recon.getOccurrence(owner.id, october.id)).metrics.planned,
    "300.00"
  );
  assert.strictEqual(
    (await recon.getOccurrence(owner.id, september.id)).metrics.planned,
    "300.00"
  );
  await assert.rejects(
    scheduleFixedVersion(
      db,
      owner.id,
      envelope.id,
      "CHARGE",
      { montant: "350.001", effectiveMonth: "2026-11" },
      today
    ),
    error("INVALID_AMOUNT")
  );
  await scheduleFixedVersion(
    db,
    owner.id,
    income.idOperationFixe,
    "REVENU",
    { montant: "2200", effectiveMonth: "2026-11" },
    today
  );
  const periods = new PrismaBudgetPeriodRepository(db, undefined, clock);
  assert.strictEqual(
    (await periods.fixedTotals(owner.id, "EUR", "2026-10")).incomeMinorUnits,
    200000
  );
  assert.strictEqual(
    (await periods.fixedTotals(owner.id, "EUR", "2026-11")).incomeMinorUnits,
    220000
  );
  await assert.rejects(
    scheduleFixedVersion(
      db,
      owner.id,
      annual.idOperationFixe,
      "CHARGE",
      { isBudgetEnvelope: true, effectiveMonth: "2026-11" },
      today
    ),
    error("INVALID_BUDGET_ENVELOPE")
  );
  await assert.rejects(
    scheduleFixedVersion(
      db,
      owner.id,
      income.idOperationFixe,
      "REVENU",
      { isBudgetEnvelope: true, effectiveMonth: "2026-11" },
      today
    ),
    error("INVALID_BUDGET_ENVELOPE")
  );
  await assert.rejects(
    scheduleFixedVersion(
      db,
      owner.id,
      income.idOperationFixe,
      "REVENU",
      { montant: "1", effectiveMonth: "2026-09" },
      today
    ),
    error("INVALID_EFFECTIVE_MONTH")
  );
  // The second envelope has no linked data: exclude that category-month from averages.
  let analytics = await reports.analytics(
    owner.id,
    { from: "2026-09", to: "2026-10", currency: "EUR" },
    page
  );
  assert.strictEqual(analytics.data[0].statistics.sampleMonths, 0);
  assert.strictEqual(
    analytics.data[0].statistics.unreconciledMonthsExcluded,
    1
  );
  const secondPayment = await real("100", "2026-10-01");
  const secondOctober = (
    await recon.listOccurrences(owner.id, "2026-10", "EUR", page)
  ).data.find((r) => r.sourceId === second.id)!;
  await recon.link(owner.id, secondPayment.id, secondOctober.id, null);
  const octoberPayment = await real("250", "2026-10-02");
  await recon.link(owner.id, octoberPayment.id, october.id, null);
  // Different currency and user must not appear in the report.
  assert.strictEqual(
    (
      await reports.overview(
        other.id,
        { from: "2026-01", to: "2026-12", currency: "EUR" },
        page
      )
    ).data.length,
    0
  );
  assert.strictEqual(
    (
      await reports.overview(
        owner.id,
        { from: "2026-01", to: "2026-12", currency: "USD" },
        page
      )
    ).data.length,
    0
  );
  today = "2026-11-01";
  analytics = await reports.analytics(
    owner.id,
    { from: "2026-09", to: "2026-10", currency: "EUR" },
    page
  );
  assert.strictEqual(analytics.data[0].statistics.sampleMonths, 1);
  assert.strictEqual(analytics.data[0].statistics.meanActual, "350.00");
  assert.strictEqual(analytics.data[0].statistics.meanPlanned, "600.00");
  assert.strictEqual(analytics.data[0].statistics.meanVariance, "-250.00");
  const annualView = await reports.overview(
    owner.id,
    { from: "2026-01", to: "2026-12", currency: "EUR" },
    { limit: 1, cursor: null }
  );
  assert.ok(annualView.meta.nextCursor);
  await assert.rejects(
    reports.overview(
      other.id,
      { from: "2026-01", to: "2026-12", currency: "EUR" },
      { limit: 1, cursor: annualView.meta.nextCursor }
    )
  );
  await assert.rejects(
    recon.updateOccurrence(owner.id, september.id, "1"),
    error("PERIOD_CLOSED")
  );
  await assert.rejects(
    recon.link(owner.id, purchases[0].id, null, september.id),
    error("PERIOD_CLOSED")
  );
  const budget = await new BudgetPeriodEngine(periods).summarize(
    owner.id,
    "2026-10",
    "EUR",
    today
  );
  assert.strictEqual(budget.period.status, "CLOSED");
  console.log(
    "Opt-in/version/report MySQL: ordinary/income excluded, snapshots, atomic links, monthly/yearly previews, future charge+income edits, means and ownership passed"
  );
}
run()
  .finally(async () => {
    await clean();
    await db.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
