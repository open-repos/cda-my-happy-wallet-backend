import assert from "assert";
import {
  MonthlyEvent,
  MonthlyEventError,
} from "../../../src/modules/monthlyEvents/domain";

const event = MonthlyEvent.create({
  id: 1,
  ownerId: 7,
  title: "  Salaire prévisionnel  ",
  amount: "2500.50",
  currency: "eur",
  kind: "ENTREE",
  startDate: "2024-01-31",
  recurrence: "MENSUELLE",
  endDate: "2024-03-31",
});

assert.strictEqual(event.title, "Salaire prévisionnel");
assert.strictEqual(event.minorUnits, 250050);
assert.strictEqual(event.currency, "EUR");
assert.strictEqual(event.occurrenceIn("2024-02"), "2024-02-29");
assert.strictEqual(event.occurrenceIn("2024-03"), "2024-03-31");
assert.strictEqual(event.occurrenceIn("2024-04"), null);

const oneTime = MonthlyEvent.create({
  ownerId: 7,
  title: "Assurance annuelle",
  amount: 90,
  currency: "EUR",
  kind: "DEPENSE",
  startDate: "2026-02-28",
  recurrence: "AUCUNE",
});
assert.strictEqual(oneTime.occurrenceIn("2026-02"), "2026-02-28");
assert.strictEqual(oneTime.occurrenceIn("2026-03"), null);

assert.throws(
  () =>
    MonthlyEvent.create({
      ownerId: 7,
      title: "Date impossible",
      amount: "1.00",
      currency: "EUR",
      kind: "DEPENSE",
      startDate: "2026-02-31",
      recurrence: "AUCUNE",
    }),
  (error: unknown) =>
    error instanceof MonthlyEventError && error.code === "INVALID_START_DATE"
);

assert.throws(
  () =>
    MonthlyEvent.create({
      ownerId: 7,
      title: "Fin incohérente",
      amount: "1.00",
      currency: "EUR",
      kind: "DEPENSE",
      startDate: "2026-02-01",
      recurrence: "AUCUNE",
      endDate: "2026-03-01",
    }),
  (error: unknown) =>
    error instanceof MonthlyEventError && error.code === "INVALID_END_DATE"
);
