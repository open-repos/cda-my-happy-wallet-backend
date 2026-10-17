import assert from "assert";
import {
  FinancialGoal,
  FinancialGoalError,
  FinancialGoalProps,
} from "../../../src/modules/financialGoals/domain";
import { civilDateIn } from "../../../src/utils/civilDateClock";

const goal = (overrides: Partial<FinancialGoalProps> = {}) =>
  FinancialGoal.create({
    ownerId: 7,
    title: "  Vacances  ",
    targetAmount: "1200.00",
    savedAmount: "300.00",
    monthlyContribution: "150.00",
    currency: "eur",
    ...overrides,
  });

const rejects = (props: Partial<FinancialGoalProps>, code: string) =>
  assert.throws(
    () => goal(props),
    (error: unknown) =>
      error instanceof FinancialGoalError && error.code === code
  );

const vacation = goal({ targetDate: "2027-03-15" });
assert.strictEqual(vacation.title, "Vacances");
assert.strictEqual(vacation.currency, "EUR");
assert.strictEqual(vacation.targetMinorUnits, 120000);

// 900 € restants à 150 €/mois : six versements, le premier en novembre.
assert.deepStrictEqual(vacation.forecast("2026-10-11"), {
  referenceMonth: "2026-10",
  remainingMinorUnits: 90000,
  status: "BEHIND",
  contributionsNeeded: 6,
  estimatedReachMonth: "2027-04",
  requiredMonthlyMinorUnits: 18000,
});
assert.strictEqual(
  goal({ targetDate: "2027-04-01" }).forecast("2026-10-31").status,
  "ON_TRACK"
);

// Arrondi au centime supérieur et passage d'année.
const uneven = goal({
  targetAmount: "100.00",
  savedAmount: 0,
  monthlyContribution: "33.33",
  targetDate: "2027-01-31",
}).forecast("2026-12-01");
assert.strictEqual(uneven.contributionsNeeded, 4);
assert.strictEqual(uneven.estimatedReachMonth, "2027-04");
assert.strictEqual(uneven.requiredMonthlyMinorUnits, 10000);
assert.strictEqual(uneven.status, "BEHIND");

const reached = goal({ savedAmount: "1500.00" }).forecast("2026-10-11");
assert.strictEqual(reached.status, "REACHED");
assert.strictEqual(reached.remainingMinorUnits, 0);
assert.strictEqual(reached.estimatedReachMonth, "2026-10");

const noDeadline = goal({ monthlyContribution: 0 }).forecast("2026-10-11");
assert.strictEqual(noDeadline.status, "NO_DEADLINE");
assert.strictEqual(noDeadline.contributionsNeeded, null);
assert.strictEqual(noDeadline.estimatedReachMonth, null);

const missed = goal({ targetDate: "2026-10-31" }).forecast("2026-10-01");
assert.strictEqual(missed.status, "MISSED");
assert.strictEqual(missed.requiredMonthlyMinorUnits, null);

const tooFar = goal({
  targetAmount: "99999999.99",
  savedAmount: 0,
  monthlyContribution: "0.01",
}).forecast("2026-10-11");
assert.strictEqual(tooFar.estimatedReachMonth, null);
assert.strictEqual(tooFar.contributionsNeeded, 9999999999);

rejects({ targetAmount: 0 }, "INVALID_TARGET_AMOUNT");
rejects({ savedAmount: "-1" }, "INVALID_SAVED_AMOUNT");
rejects({ monthlyContribution: "1.234" }, "INVALID_MONTHLY_CONTRIBUTION");
rejects({ targetDate: "2027-02-30" }, "INVALID_TARGET_DATE");
rejects({ title: " a " }, "INVALID_TITLE");
rejects({ currency: "EU" }, "INVALID_CURRENCY");
rejects({ ownerId: 0 }, "INVALID_OWNER_ID");
assert.throws(
  () => vacation.forecast("2026-13-01"),
  (error: unknown) =>
    error instanceof FinancialGoalError &&
    error.code === "INVALID_REFERENCE_DATE"
);

// Un centime change le nombre de versements et le statut à la date limite.
for (const [
  monthlyContribution,
  contributionsNeeded,
  estimatedReachMonth,
  status,
] of [
  ["900.00", 1, "2026-11", "ON_TRACK"],
  ["899.99", 2, "2026-12", "BEHIND"],
  ["0.00", null, null, "BEHIND"],
] as const) {
  const nextMonth = goal({ monthlyContribution, targetDate: "2026-11-01" });
  const expected = {
    referenceMonth: "2026-10",
    remainingMinorUnits: 90000,
    contributionsNeeded,
    estimatedReachMonth,
    status,
    requiredMonthlyMinorUnits: 90000,
  };
  assert.deepStrictEqual(nextMonth.forecast("2026-10-01"), expected);
  assert.deepStrictEqual(nextMonth.forecast("2026-10-31"), expected);
}

// Le calcul porte sur le mois, sans confondre une date passée et un objectif atteint.
assert.strictEqual(
  goal({ targetDate: "2026-09-30" }).forecast("2026-10-01").status,
  "MISSED"
);
assert.deepStrictEqual(
  goal({
    savedAmount: "1200.00",
    monthlyContribution: 0,
    targetDate: "2026-09-30",
  }).forecast("2026-10-01"),
  {
    referenceMonth: "2026-10",
    remainingMinorUnits: 0,
    status: "REACHED",
    contributionsNeeded: 0,
    estimatedReachMonth: "2026-10",
    requiredMonthlyMinorUnits: null,
  }
);
assert.deepStrictEqual(goal({ targetDate: null }).forecast("2026-10-01"), {
  referenceMonth: "2026-10",
  remainingMinorUnits: 90000,
  status: "NO_DEADLINE",
  contributionsNeeded: 6,
  estimatedReachMonth: "2027-04",
  requiredMonthlyMinorUnits: null,
});

// La borne de 100 ans est inclusive : 1 200 mois affichables, 1 201 non affichables.
for (const [targetAmount, contributionsNeeded, estimatedReachMonth] of [
  ["12.00", 1200, "2126-12"],
  ["12.01", 1201, null],
] as const) {
  const forecast = goal({
    targetAmount,
    savedAmount: 0,
    monthlyContribution: "0.01",
  }).forecast("2026-12-31");
  assert.strictEqual(forecast.contributionsNeeded, contributionsNeeded);
  assert.strictEqual(forecast.estimatedReachMonth, estimatedReachMonth);
}

for (const date of [
  "1900-02-29",
  "2100-02-29",
  "2027-02-29",
  "2026-04-31",
  "2026-00-15",
  "2026-01-00",
  "2026-1-01",
  "2026-01-01T00:00:00Z",
]) {
  rejects({ targetDate: date }, "INVALID_TARGET_DATE");
  assert.throws(
    () => vacation.forecast(date),
    (error: unknown) =>
      error instanceof FinancialGoalError &&
      error.code === "INVALID_REFERENCE_DATE",
    date
  );
}
for (const date of ["2000-02-29", "2028-02-29"]) {
  assert.strictEqual(goal({ targetDate: date }).targetDate, date);
  assert.strictEqual(vacation.forecast(date).referenceMonth, date.slice(0, 7));
}

// Instants fixes autour des sauts d'heure, de minuit et du changement d'année à Paris.
const parisDates = [
  ["2026-03-28T22:59:59.000Z", "2026-03-28"],
  ["2026-03-28T23:00:00.000Z", "2026-03-29"],
  ["2026-03-29T00:59:59.000Z", "2026-03-29"],
  ["2026-03-29T01:00:00.000Z", "2026-03-29"],
  ["2026-03-29T21:59:59.000Z", "2026-03-29"],
  ["2026-03-29T22:00:00.000Z", "2026-03-30"],
  ["2026-10-24T21:59:59.000Z", "2026-10-24"],
  ["2026-10-24T22:00:00.000Z", "2026-10-25"],
  ["2026-10-25T00:59:59.000Z", "2026-10-25"],
  ["2026-10-25T01:00:00.000Z", "2026-10-25"],
  ["2026-10-25T22:59:59.000Z", "2026-10-25"],
  ["2026-10-25T23:00:00.000Z", "2026-10-26"],
  ["2026-12-31T22:59:59.000Z", "2026-12-31"],
  ["2026-12-31T23:00:00.000Z", "2027-01-01"],
] as const;
const originalTimeZone = process.env.TZ;
try {
  for (const timeZone of ["UTC", "Pacific/Kiritimati", "America/Los_Angeles"]) {
    process.env.TZ = timeZone;
    for (const [instant, expected] of parisDates) {
      const civilDate = civilDateIn("Europe/Paris", new Date(instant));
      assert.strictEqual(civilDate, expected, `${timeZone} / ${instant}`);
      assert.strictEqual(
        vacation.forecast(civilDate).referenceMonth,
        expected.slice(0, 7)
      );
    }
  }
} finally {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
}
