import assert from "assert";
import {
  MonthlyEvent,
  MonthlyEventProps,
} from "../../../src/modules/monthlyEvents/domain";

const rule = (props: Partial<MonthlyEventProps>) =>
  MonthlyEvent.create({
    ownerId: 7,
    title: "Abonnement",
    amount: "10.01",
    currency: "EUR",
    kind: "DEPENSE",
    startDate: "2024-01-31",
    recurrence: "MENSUELLE",
    ...props,
  });
const quarterly = rule({ recurrence: "TRIMESTRIELLE" });
assert.deepStrictEqual(
  ["2023-10", "2024-01", "2024-02", "2024-04", "2024-07", "2025-01"].map((m) =>
    quarterly.occurrencesIn(m)
  ),
  [[], ["2024-01-31"], [], ["2024-04-30"], ["2024-07-31"], ["2025-01-31"]]
);
const annual = rule({ recurrence: "ANNUELLE", startDate: "2024-02-29" });
assert.deepStrictEqual(
  ["2024-02", "2024-03", "2025-02", "2028-02", "2100-02"].map((m) =>
    annual.occurrencesIn(m)
  ),
  [["2024-02-29"], [], ["2025-02-28"], ["2028-02-29"], ["2100-02-28"]]
);
const weekly = rule({
  recurrence: "HEBDOMADAIRE",
  startDate: "2024-02-23",
  endDate: "2024-03-15",
});
assert.deepStrictEqual(weekly.occurrencesIn("2024-02"), ["2024-02-23"]);
assert.deepStrictEqual(weekly.occurrencesIn("2024-03"), [
  "2024-03-01",
  "2024-03-08",
  "2024-03-15",
]);
assert.deepStrictEqual(weekly.occurrencesIn("2024-04"), []);
assert.deepStrictEqual(
  rule({ recurrence: "HEBDOMADAIRE", startDate: "2026-12-25" }).occurrencesIn(
    "2027-01"
  ),
  ["2027-01-01", "2027-01-08", "2027-01-15", "2027-01-22", "2027-01-29"]
);
assert.deepStrictEqual(
  rule({ recurrence: "HEBDOMADAIRE", startDate: "2026-03-22" }).occurrencesIn(
    "2026-03"
  ),
  ["2026-03-22", "2026-03-29"]
);
assert.deepStrictEqual(
  rule({
    recurrence: "ANNUELLE",
    startDate: "2024-02-29",
    endDate: "2025-02-27",
  }).occurrencesIn("2025-02"),
  []
);
assert.deepStrictEqual(
  rule({
    recurrence: "ANNUELLE",
    startDate: "2024-02-29",
    endDate: "2025-02-28",
  }).occurrencesIn("2025-02"),
  ["2025-02-28"]
);
assert.deepStrictEqual(
  rule({
    recurrence: "TRIMESTRIELLE",
    startDate: "2024-01-31",
    endDate: "2024-04-30",
  }).occurrencesIn("2024-04"),
  ["2024-04-30"]
);
assert.deepStrictEqual(
  rule({ recurrence: "AUCUNE" }).occurrencesIn("2024-02"),
  []
);
for (const month of ["bad", "2024-13", "2024-00"])
  assert.throws(() => weekly.occurrencesIn(month));
// Date generation is invariant under process timezone, including a DST transition.
const originalTimezone = process.env.TZ;
try {
  for (const zone of ["UTC", "Europe/Paris", "America/New_York"]) {
    process.env.TZ = zone;
    assert.deepStrictEqual(
      rule({
        recurrence: "HEBDOMADAIRE",
        startDate: "2026-03-22",
      }).occurrencesIn("2026-03"),
      ["2026-03-22", "2026-03-29"]
    );
  }
} finally {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
}
