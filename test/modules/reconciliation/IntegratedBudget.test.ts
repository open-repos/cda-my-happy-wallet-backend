import assert from "assert";
import {
  calculateRealBudget,
  BudgetMovement,
} from "../../../src/modules/budgetPeriods/domain/BudgetPeriod";
import { calculateForecastBudget } from "../../../src/modules/budgetPeriods/domain/BudgetForecast";
const payment = (minorUnits: number, day = "10"): BudgetMovement => ({
  operationDate: `2026-10-${day}`,
  minorUnits,
  kind: "DEPENSE",
  fixedReconciliation: { occurrenceId: 1, plannedMinorUnits: 30000 },
});
const budget = (
  movements: readonly BudgetMovement[],
  today = "2026-10-20",
  extra = {}
) =>
  calculateRealBudget({
    month: "2026-10",
    currency: "EUR",
    today,
    fixedIncomeMinorUnits: 200000,
    fixedExpenseMinorUnits: 30000,
    movements,
    ...extra,
  });
const over = budget([payment(40000)]);
assert.strictEqual(over.actualExpenseMinorUnits, 40000);
assert.strictEqual(over.reconciliationAdjustmentMinorUnits, 30000);
assert.strictEqual(over.monthResultMinorUnits, 160000); // 2,000 - 400, never -700
assert.strictEqual(budget([payment(22300)]).realRemainingMinorUnits, 170000);
const closed = budget([payment(22300)], "2026-11-01");
assert.strictEqual(closed.realRemainingMinorUnits, 177700);
assert.strictEqual(
  closed.days.at(-1)!.realRemainingMinorUnits,
  closed.realRemainingMinorUnits
);
assert.strictEqual(budget([], "2026-11-01").realRemainingMinorUnits, 170000); // no guessed realization
const multiple = budget([
  payment(11000, "25"),
  payment(8500),
  payment(4200, "15"),
  payment(9600, "20"),
]);
assert.strictEqual(multiple.actualExpenseMinorUnits, 33300);
assert.strictEqual(multiple.realRemainingMinorUnits, 166700);
assert.strictEqual(multiple.days[9].realRemainingMinorUnits, 170000);
assert.strictEqual(multiple.days.at(-1)!.realRemainingMinorUnits, 166700);
const salary: BudgetMovement = {
  operationDate: "2026-10-02",
  minorUnits: 218000,
  kind: "ENTREE",
  fixedReconciliation: { occurrenceId: 2, plannedMinorUnits: 220000 },
};
const income = (today: string) =>
  calculateRealBudget({
    month: "2026-10",
    currency: "EUR",
    today,
    fixedIncomeMinorUnits: 220000,
    fixedExpenseMinorUnits: 0,
    movements: [salary],
  });
assert.strictEqual(income("2026-10-20").realRemainingMinorUnits, 220000);
assert.strictEqual(income("2026-11-01").realRemainingMinorUnits, 218000);
const unmatched: BudgetMovement = {
  operationDate: "2026-10-02",
  minorUnits: 1001,
  kind: "DEPENSE",
};
assert.strictEqual(
  budget([payment(40000), unmatched]).realRemainingMinorUnits,
  158999
);
assert.strictEqual(
  budget([payment(40000)], "2026-11-01", { carryInMinorUnits: -50000 })
    .realRemainingMinorUnits,
  110000
);
assert.strictEqual(
  budget([payment(40000)], "2026-11-01", {
    frozenReconciliationAdjustmentMinorUnits: 0,
  }).realRemainingMinorUnits,
  130000
); // old closed snapshot
const real = calculateRealBudget({
  month: "2026-10",
  currency: "EUR",
  today: "2026-10-20",
  fixedIncomeMinorUnits: 200000,
  fixedExpenseMinorUnits: 0,
  movements: [{ ...unmatched, minorUnits: 22300 }],
});
const projected = calculateForecastBudget({
  real,
  today: "2026-10-20",
  planned: [],
  goalSavingsMinorUnits: 10000,
  envelopeReserveMinorUnits: 7700,
});
assert.strictEqual(projected.forecastRemainingMinorUnits, 160000); // 2,000 - 300 - 100
assert.strictEqual(
  projected.days.at(-1)!.forecastRemainingMinorUnits,
  projected.forecastRemainingMinorUnits
);
assert.throws(() =>
  calculateForecastBudget({
    real,
    today: "2026-10-20",
    planned: [],
    goalSavingsMinorUnits: 0,
    envelopeReserveMinorUnits: -1,
  })
);
console.log(
  "Integrated budget domain: monthly surplus, actual closure, income shortfall, raw totals, daily allocation, carry and envelope reserves passed"
);
