import assert from "assert";
import {
  BudgetPeriodError,
  calculateForecastBudget,
  calculateRealBudget,
} from "../../../src/modules/budgetPeriods/domain";

const real = calculateRealBudget({
  month: "2026-10",
  currency: "EUR",
  today: "2026-10-11",
  fixedIncomeMinorUnits: 200000,
  fixedExpenseMinorUnits: 80000,
  movements: [
    { operationDate: "2026-10-03", minorUnits: 4000, kind: "DEPENSE" },
  ],
});
assert.strictEqual(real.realRemainingMinorUnits, 116000);
assert.strictEqual(real.remainingDays, 21);

const forecast = calculateForecastBudget({
  real,
  today: "2026-10-11",
  goalSavingsMinorUnits: 15000,
  planned: [
    {
      occurrenceDate: "2026-10-05",
      kind: "DEPENSE",
      minorUnits: 2000,
      count: 1,
    },
    {
      occurrenceDate: "2026-10-15",
      kind: "DEPENSE",
      minorUnits: 30000,
      count: 2,
    },
    {
      occurrenceDate: "2026-10-20",
      kind: "ENTREE",
      minorUnits: 5000,
      count: 1,
    },
  ],
});

// Reste réel 1 160 € − 320 € planifiés + 50 € − 150 € d'épargne = 740 €.
assert.strictEqual(forecast.plannedExpenseMinorUnits, 32000);
assert.strictEqual(forecast.plannedIncomeMinorUnits, 5000);
assert.strictEqual(forecast.goalSavingsMinorUnits, 15000);
assert.strictEqual(forecast.forecastRemainingMinorUnits, 74000);
assert.strictEqual(forecast.prudentDailyAllowanceMinorUnits, 3524);
assert.strictEqual(forecast.unresolvedCount, 4);
assert.strictEqual(forecast.overdueCount, 1);
assert.strictEqual(forecast.days.length, 31);
// L'épargne est réservée dès le premier jour.
assert.strictEqual(forecast.days[0].forecastRemainingMinorUnits, 105000);
assert.deepStrictEqual(forecast.days[14], {
  date: "2026-10-15",
  plannedIncomeMinorUnits: 0,
  plannedExpenseMinorUnits: 30000,
  plannedCount: 2,
  forecastRemainingMinorUnits: 69000,
});
assert.strictEqual(
  forecast.days[30].forecastRemainingMinorUnits,
  forecast.forecastRemainingMinorUnits
);

// Le réel ne contient jamais le prévisionnel : pas de double comptage.
assert.strictEqual(real.realRemainingMinorUnits, 116000);

const negative = calculateForecastBudget({
  real: calculateRealBudget({
    month: "2026-04",
    currency: "EUR",
    today: "2026-04-28",
    fixedIncomeMinorUnits: 0,
    fixedExpenseMinorUnits: 0,
    movements: [],
  }),
  today: "2026-04-28",
  goalSavingsMinorUnits: 0,
  planned: [
    {
      occurrenceDate: "2026-04-30",
      kind: "DEPENSE",
      minorUnits: 6000,
      count: 1,
    },
  ],
});
assert.strictEqual(negative.forecastRemainingMinorUnits, -6000);
assert.strictEqual(negative.prudentDailyAllowanceMinorUnits, -2000);
assert.strictEqual(negative.overdueCount, 0);

const past = calculateForecastBudget({
  real: calculateRealBudget({
    month: "2026-09",
    currency: "EUR",
    today: "2026-10-11",
    fixedIncomeMinorUnits: 0,
    fixedExpenseMinorUnits: 0,
    movements: [],
  }),
  today: "2026-10-11",
  goalSavingsMinorUnits: 0,
  planned: [],
});
assert.strictEqual(past.prudentDailyAllowanceMinorUnits, null);

assert.throws(
  () =>
    calculateForecastBudget({
      real,
      today: "2026-10-11",
      goalSavingsMinorUnits: 0,
      planned: [
        {
          occurrenceDate: "2026-11-01",
          kind: "DEPENSE",
          minorUnits: 1,
          count: 1,
        },
      ],
    }),
  (error: unknown) =>
    error instanceof BudgetPeriodError &&
    error.code === "MOVEMENT_OUTSIDE_PERIOD"
);
assert.throws(
  () =>
    calculateForecastBudget({
      real,
      today: "2026-10-11",
      goalSavingsMinorUnits: -1,
      planned: [],
    }),
  (error: unknown) =>
    error instanceof BudgetPeriodError && error.code === "INVALID_AMOUNT"
);
