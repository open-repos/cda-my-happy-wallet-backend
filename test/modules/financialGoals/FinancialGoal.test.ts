import assert from "assert";
import {
  FinancialGoal,
  FinancialGoalError,
  FinancialGoalProps,
} from "../../../src/modules/financialGoals/domain";

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
