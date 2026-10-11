import assert from "assert";
import {
  EventOccurrenceUseCases,
  OccurrenceResolutionConflict,
  OccurrenceResolutionRepository,
} from "../../../src/modules/eventOccurrences/application";
import {
  OccurrenceResolution,
  OccurrenceResolutionError,
  OccurrenceSnapshot,
  PendingOccurrence,
} from "../../../src/modules/eventOccurrences/domain";
import { MonthlyEvent } from "../../../src/modules/monthlyEvents/domain";
import { OneOffOperation } from "../../../src/modules/operations/domain";
import { CursorPage, PaginationRequest } from "../../../src/modules/pagination";

const OWNER = 7;
const rent = MonthlyEvent.create({
  id: 1,
  ownerId: OWNER,
  title: "Loyer",
  amount: "800.00",
  currency: "EUR",
  kind: "DEPENSE",
  startDate: "2026-01-31",
  recurrence: "MENSUELLE",
});

class FakeResolutions implements OccurrenceResolutionRepository {
  public rows: OccurrenceResolution[] = [];
  public operations = 0;
  public pendingWindow: [string, string] | null = null;
  /** Simule une décision concurrente insérée juste avant l'écriture. */
  public raceWith: OccurrenceResolution | null = null;

  public async find(ownerId: number, eventId: number, date: string) {
    return (
      this.rows.find(
        (row) =>
          row.ownerId === ownerId &&
          row.sourceEventId === eventId &&
          row.occurrenceDate === date
      ) ?? null
    );
  }
  public async realize(
    snapshot: OccurrenceSnapshot,
    operation: OneOffOperation
  ): Promise<OccurrenceResolution> {
    this.applyRace();
    if (
      await this.find(
        snapshot.ownerId,
        snapshot.sourceEventId,
        snapshot.occurrenceDate
      )
    )
      throw new OccurrenceResolutionConflict();
    this.operations += 1;
    return this.save({
      ...snapshot,
      id: this.rows.length + 1,
      status: "REALIZED",
      resolvedAt: new Date(),
      operation: {
        id: this.operations,
        title: operation.title,
        minorUnits: operation.money.minorUnits,
        operationDate: operation.operationDate,
        categoryId: operation.categoryId,
      },
    });
  }
  public async cancel(snapshot: OccurrenceSnapshot) {
    this.applyRace();
    if (
      await this.find(
        snapshot.ownerId,
        snapshot.sourceEventId,
        snapshot.occurrenceDate
      )
    )
      throw new OccurrenceResolutionConflict();
    return this.save({
      ...snapshot,
      id: this.rows.length + 1,
      status: "CANCELED",
      resolvedAt: new Date(),
      operation: null,
    });
  }
  public async listPending(
    _: number,
    from: string,
    through: string,
    page: PaginationRequest
  ): Promise<CursorPage<PendingOccurrence>> {
    this.pendingWindow = [from, through];
    return {
      data: [],
      meta: { limit: page.limit, hasNext: false, nextCursor: null },
    };
  }
  private applyRace() {
    if (this.raceWith != null) {
      this.rows.push(this.raceWith);
      this.raceWith = null;
    }
  }
  private save(row: OccurrenceResolution) {
    this.rows.push(row);
    return row;
  }
}

const build = (today = "2026-10-11", closedMonth: string | null = null) => {
  const resolutions = new FakeResolutions();
  const useCases = new EventOccurrenceUseCases(
    {
      findById: async (id, ownerId) =>
        id === rent.id && ownerId === OWNER ? rent : null,
    },
    {
      findById: async (id, ownerId) =>
        id === 3 && ownerId === OWNER
          ? { id: 3, ownerId: OWNER, name: "Logement", color: null }
          : null,
    },
    {
      find: async (_, month) =>
        month === closedMonth ? ({ status: "CLOSED" } as never) : null,
    },
    resolutions,
    () => today
  );
  return { resolutions, useCases };
};

const rejectsWith = (promise: Promise<unknown>, code: string) =>
  assert.rejects(
    promise,
    (error: unknown) =>
      error instanceof OccurrenceResolutionError && error.code === code
  );

async function run() {
  const { resolutions, useCases } = build();

  // La file couvre le mois courant et les 11 précédents, passage d'année inclus.
  await useCases.pending(OWNER, undefined, { limit: 10, cursor: null });
  assert.deepStrictEqual(resolutions.pendingWindow, [
    "2025-11-01",
    "2026-10-11",
  ]);
  await useCases.pending(OWNER, "2027-01-15", { limit: 10, cursor: null });
  assert.deepStrictEqual(resolutions.pendingWindow, [
    "2026-02-01",
    "2027-01-15",
  ]);

  // Le 31 du mois d'ancrage tombe le 31 octobre.
  const realized = await useCases.realize(OWNER, 1, "2026-10-31", {
    categoryId: 3,
    amount: "812.40",
  });
  assert.strictEqual(realized.replayed, false);
  assert.strictEqual(realized.resolution.status, "REALIZED");
  assert.strictEqual(realized.resolution.minorUnits, 80000);
  assert.strictEqual(realized.resolution.operation?.minorUnits, 81240);
  assert.strictEqual(realized.resolution.operation?.title, "Loyer");

  const replay = await useCases.realize(OWNER, 1, "2026-10-31", {
    categoryId: 3,
    amount: "812.40",
  });
  assert.strictEqual(replay.replayed, true);
  assert.strictEqual(resolutions.operations, 1);

  await rejectsWith(
    useCases.realize(OWNER, 1, "2026-10-31", { categoryId: 3 }),
    "OCCURRENCE_ALREADY_RESOLVED"
  );
  await rejectsWith(
    useCases.cancel(OWNER, 1, "2026-10-31"),
    "OCCURRENCE_ALREADY_RESOLVED"
  );

  const canceled = await useCases.cancel(OWNER, 1, "2026-11-30");
  assert.strictEqual(canceled.resolution.status, "CANCELED");
  assert.strictEqual(
    (await useCases.cancel(OWNER, 1, "2026-11-30")).replayed,
    true
  );
  await rejectsWith(
    useCases.realize(OWNER, 1, "2026-11-30", { categoryId: 3 }),
    "OCCURRENCE_ALREADY_RESOLVED"
  );

  await rejectsWith(
    useCases.realize(OWNER, 1, "2026-02-28", {
      categoryId: 3,
      operationDate: "2026-09-30",
    }),
    "PERIOD_CLOSED"
  );
  // Une occurrence en retard peut être réalisée à une date du mois courant.
  const late = await useCases.realize(OWNER, 1, "2026-09-30", {
    categoryId: 3,
    operationDate: "2026-10-02",
  });
  assert.strictEqual(late.resolution.operation?.operationDate, "2026-10-02");
  // Une annulation passée ne touche aucun montant et reste autorisée.
  assert.strictEqual(
    (await useCases.cancel(OWNER, 1, "2026-08-31")).resolution.status,
    "CANCELED"
  );

  await rejectsWith(
    useCases.realize(OWNER, 1, "2026-12-30", { categoryId: 3 }),
    "OCCURRENCE_NOT_FOUND"
  );
  await rejectsWith(
    useCases.realize(OWNER, 1, "2026-02-31", { categoryId: 3 }),
    "OCCURRENCE_NOT_FOUND"
  );
  await rejectsWith(
    useCases.realize(8, 1, "2026-12-31", { categoryId: 3 }),
    "EVENT_NOT_FOUND"
  );
  await rejectsWith(useCases.cancel(8, 1, "2026-12-31"), "EVENT_NOT_FOUND");
  await rejectsWith(
    useCases.realize(OWNER, 1, "2026-12-31", { categoryId: 99 }),
    "CATEGORY_NOT_FOUND"
  );

  const closed = build("2026-10-11", "2026-10");
  await rejectsWith(
    closed.useCases.realize(OWNER, 1, "2026-10-31", { categoryId: 3 }),
    "PERIOD_CLOSED"
  );

  // Course : une autre requête réalise la même occurrence avec la même commande.
  const winner = await build().useCases.realize(OWNER, 1, "2027-01-31", {
    categoryId: 3,
  });
  const contender = build();
  contender.resolutions.raceWith = winner.resolution;
  const replayed = await contender.useCases.realize(OWNER, 1, "2027-01-31", {
    categoryId: 3,
  });
  assert.strictEqual(replayed.replayed, true);
  assert.strictEqual(contender.resolutions.operations, 0);

  const cancelRace = build();
  cancelRace.resolutions.raceWith = winner.resolution;
  await rejectsWith(
    cancelRace.useCases.cancel(OWNER, 1, "2027-01-31"),
    "OCCURRENCE_ALREADY_RESOLVED"
  );
}

run().catch((error) => {
  throw error;
});
