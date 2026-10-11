import assert from "assert";
import {
  BudgetPeriodError,
  calculateRealBudget,
  monthBounds,
} from "../../../src/modules/budgetPeriods/domain";

const summary = calculateRealBudget({
  month: "2026-09",
  currency: "EUR",
  today: "2026-09-19",
  fixedIncomeMinorUnits: 236400,
  fixedExpenseMinorUnits: 150040,
  movements: [
    {
      operationDate: "2026-09-02",
      minorUnits: 2050,
      kind: "DEPENSE",
    },
    {
      operationDate: "2026-09-02",
      minorUnits: 500,
      kind: "ENTREE",
    },
    {
      operationDate: "2026-09-18",
      minorUnits: 4780,
      kind: "DEPENSE",
    },
  ],
});

assert.strictEqual(summary.baseMinorUnits, 86360);
assert.strictEqual(summary.actualIncomeMinorUnits, 500);
assert.strictEqual(summary.actualExpenseMinorUnits, 6830);
assert.strictEqual(summary.realRemainingMinorUnits, 80030);
assert.strictEqual(summary.balanceStatus, "POSITIVE");
assert.strictEqual(summary.remainingDays, 12);
assert.strictEqual(summary.realDailyAllowanceMinorUnits, 6669);
assert.strictEqual(summary.days.length, 30);
assert.deepStrictEqual(summary.days[1], {
  date: "2026-09-02",
  incomeMinorUnits: 500,
  expenseMinorUnits: 2050,
  realRemainingMinorUnits: 84810,
});
assert.strictEqual(summary.days[29].realRemainingMinorUnits, 80030);

assert.deepStrictEqual(monthBounds("2027-02"), {
  start: "2027-02-01",
  end: "2027-02-28",
  days: 28,
});
assert.strictEqual(monthBounds("2028-02").days, 29);
assert.strictEqual(monthBounds("2026-04").days, 30);
assert.strictEqual(monthBounds("2026-01").days, 31);

const lastDay = calculateRealBudget({
  month: "2026-04",
  currency: "EUR",
  today: "2026-04-30",
  fixedIncomeMinorUnits: 2500,
  fixedExpenseMinorUnits: 0,
  movements: [],
});
assert.strictEqual(lastDay.remainingDays, 1);
assert.strictEqual(lastDay.realDailyAllowanceMinorUnits, 2500);

const negative = calculateRealBudget({
  month: "2026-04",
  currency: "EUR",
  today: "2026-04-28",
  fixedIncomeMinorUnits: 0,
  fixedExpenseMinorUnits: 6000,
  movements: [],
});
assert.strictEqual(negative.balanceStatus, "NEGATIVE");
assert.strictEqual(negative.realDailyAllowanceMinorUnits, -2000);

assert.throws(
  () =>
    calculateRealBudget({
      month: "2026-04",
      currency: "EUR",
      today: "2026-04-01",
      fixedIncomeMinorUnits: 0,
      fixedExpenseMinorUnits: 0,
      movements: [
        {
          operationDate: "2026-05-01",
          minorUnits: 100,
          kind: "DEPENSE",
        },
      ],
    }),
  (error: unknown) =>
    error instanceof BudgetPeriodError &&
    error.code === "MOVEMENT_OUTSIDE_PERIOD"
);
