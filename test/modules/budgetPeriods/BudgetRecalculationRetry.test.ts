import assert from "assert";
import {
  BudgetPeriodEngine,
  BudgetPeriodEngineError,
  BudgetPeriodRepository,
  BudgetPeriodState,
  MAX_RECALCULATION_ATTEMPTS,
  jitteredRetryDelay,
} from "../../../src/modules/budgetPeriods/application";

const TODAY = "2026-10-11";

// Mois ouvert dont le report est périmé : le recalcul doit l'écrire.
const openPeriod: BudgetPeriodState = {
  id: 1,
  ownerId: 7,
  month: "2026-10",
  currency: "EUR",
  status: "OPEN",
  fixedIncomeMinorUnits: 0,
  fixedExpenseMinorUnits: 0,
  actualIncomeMinorUnits: 0,
  actualExpenseMinorUnits: 0,
  realRemainingMinorUnits: 0,
  carryInMinorUnits: 100,
  unresolvedEvents: 0,
  revision: 1,
  closedAt: null,
  correctedAt: null,
};

/**
 * Dépôt instrumenté : un écrivain concurrent gagne les `conflicts` premières
 * courses et augmente la révision. Une écriture sur une révision périmée est
 * refusée, comme le verrou optimiste du dépôt Prisma.
 */
const contendedRepository = (conflicts: number) => {
  let revision = 1;
  let remaining = conflicts;
  let reads = 0;
  let attempts = 0;
  const written: unknown[] = [];
  const repository = {
    listFrom: async () => {
      reads += 1;
      return [{ ...openPeriod, revision }];
    },
    firstActivityMonth: async () => null,
    recalculate: async (
      _id: number,
      _ownerId: number,
      expectedRevision: number,
      values: unknown
    ) => {
      attempts += 1;
      if (remaining > 0) {
        remaining -= 1;
        revision += 1;
        return false;
      }
      if (expectedRevision !== revision) return false;
      revision += 1;
      written.push(values);
      return true;
    },
  } as unknown as BudgetPeriodRepository;
  return {
    repository,
    writes: () => attempts,
    reads: () => reads,
    written: () => written,
  };
};

const run = async () => {
  // Les tentatives sont espacées, l'attente croît et reste bornée.
  for (const conflicts of [0, 1, MAX_RECALCULATION_ATTEMPTS - 1]) {
    const pauses: number[] = [];
    const { repository, writes, reads, written } =
      contendedRepository(conflicts);
    const engine = new BudgetPeriodEngine(repository, async (attempt) => {
      pauses.push(attempt);
    });
    await engine.recalculateFrom(7, "2026-09", "EUR", TODAY);
    assert.strictEqual(writes(), conflicts + 1, `${conflicts} conflits`);
    // Chaque tentative relit les périodes et donc la révision courante.
    assert.strictEqual(reads(), conflicts + 1);
    assert.deepStrictEqual(written(), [{ carryInMinorUnits: 0 }]);
    assert.deepStrictEqual(
      pauses,
      Array.from({ length: conflicts }, (_, index) => index + 1)
    );
  }

  // Au-delà du nombre de tentatives, l'erreur stable est conservée.
  const pauses: number[] = [];
  const exhausted = contendedRepository(MAX_RECALCULATION_ATTEMPTS);
  await assert.rejects(
    new BudgetPeriodEngine(exhausted.repository, async (attempt) => {
      pauses.push(attempt);
    }).recalculateFrom(7, "2026-09", "EUR", TODAY),
    (error: unknown) =>
      error instanceof BudgetPeriodEngineError &&
      error.code === "CONCURRENT_UPDATE"
  );
  assert.strictEqual(exhausted.writes(), MAX_RECALCULATION_ATTEMPTS);
  assert.strictEqual(pauses.length, MAX_RECALCULATION_ATTEMPTS - 1);

  // Délai aléatoire, croissant et borné, pour désynchroniser les écrivains.
  for (let attempt = 1; attempt < MAX_RECALCULATION_ATTEMPTS; attempt += 1) {
    const low = jitteredRetryDelay(attempt, () => 0);
    const high = jitteredRetryDelay(attempt, () => 0.999999);
    assert.ok(low >= 1 && high > low, `${attempt}: ${low} < ${high}`);
    assert.ok(high <= 200, `${attempt}: borne ${high}`);
  }
  assert.ok(
    jitteredRetryDelay(MAX_RECALCULATION_ATTEMPTS - 1, () => 0) >
      jitteredRetryDelay(1, () => 0)
  );

  // Le mois courant n'est jamais recalculé.
  const untouched = contendedRepository(0);
  await new BudgetPeriodEngine(untouched.repository, async () => {
    throw new Error("no pause expected");
  }).recalculateFrom(7, "2026-10", "EUR", TODAY);
  assert.strictEqual(untouched.writes(), 0);

  console.log("Budget recalculation retry tests passed");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
