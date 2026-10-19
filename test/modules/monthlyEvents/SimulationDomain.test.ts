import assert from "assert";
import {
  MonthlyEvent,
  MonthlyEventProps,
} from "../../../src/modules/monthlyEvents/domain";
import { civilDateIn } from "../../../src/utils/civilDateClock";

const event = (props: Partial<MonthlyEventProps> = {}) =>
  MonthlyEvent.create({
    ownerId: 7,
    title: "Voyage potentiel",
    amount: "50.00",
    currency: "EUR",
    kind: "DEPENSE",
    startDate: "2026-10-01",
    recurrence: "AUCUNE",
    status: "POTENTIEL",
    ...props,
  });
assert.strictEqual(event({ status: undefined }).status, "CONFIRME");
assert.strictEqual(event().isExpired("2026-10-31"), false);
assert.strictEqual(event().isExpired("2026-11-01"), true);
assert.strictEqual(
  event({ status: "CONFIRME" }).isExpired("2030-01-01"),
  false
);
assert.strictEqual(
  event({ startDate: "2026-11-30" }).isExpired("2026-11-01"),
  false
);
// An unconfirmed recurring series expires with the month of its first occurrence.
assert.strictEqual(
  event({ recurrence: "ANNUELLE", endDate: "2030-10-01" }).isExpired(
    "2026-11-01"
  ),
  true
);
assert.throws(() => event({ status: "OTHER" as never }));
assert.throws(() => event().isExpired("2026-02-30"));
// UTC instant immediately before/after Paris crosses the end-of-month boundary.
const before = civilDateIn(
  "Europe/Paris",
  new Date("2026-10-31T22:59:59.999Z")
);
const after = civilDateIn("Europe/Paris", new Date("2026-10-31T23:00:00.000Z"));
assert.strictEqual(event().isExpired(before), false);
assert.strictEqual(event().isExpired(after), true);
