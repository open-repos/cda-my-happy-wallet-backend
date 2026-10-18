import assert from "assert";
import {
  MonthlyEvent,
  MonthlyEventError,
  MonthlyEventProps,
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

const recurring = (overrides: Partial<MonthlyEventProps> = {}) =>
  MonthlyEvent.create({
    ownerId: 7,
    title: "Fin de mois",
    amount: "1.00",
    currency: "EUR",
    kind: "DEPENSE",
    startDate: "2027-01-31",
    recurrence: "MENSUELLE",
    ...overrides,
  });

// Les ancrages 29 et 30 retrouvent eux aussi leur jour après février.
for (const [startDate, expected] of [
  ["2027-01-29", ["2027-02-28", "2027-03-29", "2028-02-29"]],
  ["2027-01-30", ["2027-02-28", "2027-03-30", "2028-02-29"]],
] as const) {
  const rule = recurring({ startDate });
  assert.deepStrictEqual(
    ["2027-02", "2027-03", "2028-02"].map((month) => rule.occurrenceIn(month)),
    expected,
    startDate
  );
}

// Début et fin inclusifs, y compris lorsque la dernière occurrence est rabattue.
for (const [startDate, endDate, month, expected] of [
  ["2026-01-31", "2026-02-28", "2025-12", null],
  ["2026-01-31", "2026-02-28", "2026-01", "2026-01-31"],
  ["2026-01-31", "2026-02-28", "2026-02", "2026-02-28"],
  ["2026-01-31", "2026-02-28", "2026-03", null],
  ["2026-01-31", "2026-02-27", "2026-02", null],
  ["2028-01-31", "2028-02-28", "2028-02", null],
  ["2028-01-31", "2028-02-29", "2028-02", "2028-02-29"],
  ["2026-03-15", "2026-03-15", "2026-03", "2026-03-15"],
  ["2026-03-15", "2026-03-15", "2026-04", null],
] as const) {
  assert.strictEqual(
    recurring({ startDate, endDate }).occurrenceIn(month),
    expected,
    `${startDate}..${endDate} / ${month}`
  );
}
assert.strictEqual(oneTime.occurrenceIn("2026-01"), null);

const invalidDates = [
  "1900-02-29",
  "2100-02-29",
  "2027-02-29",
  "2026-04-31",
  "2026-00-15",
  "2026-13-01",
  "2026-01-00",
  "2026-01-32",
  "2026-1-01",
  "2026-01-01T00:00:00Z",
];
for (const startDate of invalidDates) {
  assert.throws(
    () => recurring({ startDate }),
    (error: unknown) =>
      error instanceof MonthlyEventError && error.code === "INVALID_START_DATE",
    startDate
  );
}
for (const endDate of [...invalidDates, "2026-12-31"]) {
  assert.throws(
    () => recurring({ endDate }),
    (error: unknown) =>
      error instanceof MonthlyEventError && error.code === "INVALID_END_DATE",
    endDate
  );
}
for (const date of ["2000-02-29", "2028-02-29"]) {
  assert.strictEqual(
    recurring({ startDate: date }).occurrenceIn(date.slice(0, 7)),
    date
  );
}
for (const month of ["2026-00", "2026-13", "2026-2", "2026-02-01", "invalid"]) {
  assert.throws(
    () => event.occurrenceIn(month),
    (error: unknown) =>
      error instanceof MonthlyEventError && error.code === "INVALID_START_DATE",
    month
  );
}
