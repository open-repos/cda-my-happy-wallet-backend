import assert from "assert";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import {
  calculateSavingsTrajectory,
  decimalMinor,
  SavingsTrajectoryMonth,
} from "../../../src/modules/financialGoals/domain/SavingsTrajectory";

const goal = (
  overrides: Partial<Parameters<typeof FinancialGoal.create>[0]> = {}
) =>
  FinancialGoal.create({
    id: 1,
    ownerId: 7,
    title: "Voyage familial de longue durée",
    currency: "EUR",
    targetAmount: "6000.00",
    savedAmount: "1800.00",
    monthlyContribution: "350.00",
    targetDate: "2027-05-31",
    ...overrides,
  });
const selected = goal();
const other = goal({
  id: 2,
  title: "Réserve pour travaux de rénovation",
  monthlyContribution: "150.00",
  targetAmount: "90000.00",
  savedAmount: "0.00",
});
const months = (
  count = 24,
  opening = 70000,
  flows: number[] = []
): SavingsTrajectoryMonth[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2026, 9 + index, 1))
      .toISOString()
      .slice(0, 7);
    return {
      month: date,
      forecastRemainingMinorUnits: index === 0 ? opening : 0,
      forecastResultMinorUnits:
        index === 0 ? opening : (flows[index - 1] ?? 160000) - 50000,
      goalSavingsMinorUnits: 50000,
    };
  });
const assumptions = {
  currentRemainingVariableExpense: 10000,
  futureAdditionalVariableExpense: 70000,
  monthlySafetyMargin: 10000,
};
const calc = (
  mode: "planned" | "maximum" | "reasonable",
  data = months(),
  goals = [selected, other]
) => calculateSavingsTrajectory(goals, 1, data, assumptions, mode);
const planned = calc("planned");
const maximum = calc("maximum");
const reasonable = calc("reasonable");
assert.strictEqual(planned.estimatedReachMonth, "2027-10");
assert.strictEqual(maximum.estimatedReachMonth, "2027-01");
assert.strictEqual(reasonable.estimatedReachMonth, "2027-05");
assert.strictEqual(reasonable.months[0].selectedTotalContribution, "650.00");
assert.strictEqual(reasonable.months[0].allocatedSupplement, "300.00");
assert.strictEqual(maximum.months[0].selectedTotalContribution, "1450.00");
assert.strictEqual(reasonable.current.remainingUnderAssumptions, "500.00");
assert.deepStrictEqual(reasonable.points[0], {
  month: "2026-10",
  savedAmount: "1800.00",
  kind: "DECLARED",
});
assert.strictEqual(reasonable.months[0].month, "2026-11");
assert.strictEqual(selected.savedMinorUnits, 180000);
for (const projection of [planned, maximum, reasonable]) {
  for (const month of projection.months) {
    assert.strictEqual(month.allocations[1].reservedContribution, "150.00");
    assert.strictEqual(month.allocations[1].projectedContribution, "150.00");
    assert.ok(Number(month.allocations[0].projectedSavedAmount) <= 6000);
  }
  assert.strictEqual(
    projection.months.at(-1)?.existingReservedContributions,
    "500.00"
  );
}
// A huge current stock is never reinterpreted as newly available savings.
assert.strictEqual(
  calc("maximum", months(3, 90000000)).months[0].selectedTotalContribution,
  "1450.00"
);
// Negative carry must be repaid before allocating a supplement; it is not erased.
const debt = calc("maximum", months(3, -200000));
assert.strictEqual(debt.months[0].allocatedSupplement, "0.00");
assert.strictEqual(debt.months[0].carryOut, "-900.00");
assert.strictEqual(debt.months[1].allocatedSupplement, "200.00");
assert.strictEqual(debt.reachReason, "OUTSIDE_HORIZON");
assert.strictEqual(debt.estimatedReachMonth, null);
// Future adverse events preserve deficits and make an early nominal crossing unfinanceable.
const deficit = calc(
  "maximum",
  months(6, 0, [-300000, 160000, 160000, 160000, 160000])
);
assert.strictEqual(deficit.months[0].fundable, false);
assert.strictEqual(deficit.estimatedReachMonth, null);
// Margin is protected every month; it cannot become the next month's supplement.
assert.strictEqual(reasonable.months[1].allocatedSupplement, "300.00");
assert.strictEqual(reasonable.months[1].protectedBalance, "800.00");
assert.strictEqual(reasonable.points[1].savedAmount, "2450.00");
assert.strictEqual(calc("planned", months(2)).reachReason, "OUTSIDE_HORIZON");
assert.strictEqual(calc("planned", months(1)).reachReason, "OUTSIDE_HORIZON");
const noPayment = [
  goal({ monthlyContribution: "0.00", targetDate: null }),
  other,
];
assert.strictEqual(
  calc("planned", months(), noPayment).reachReason,
  "NO_CONTRIBUTION"
);
assert.strictEqual(
  calc("maximum", months(), noPayment).reachReason,
  "PROJECTED"
);
const reached = calc("reasonable", months(), [
  goal({ savedAmount: "7000.00" }),
  other,
]);
assert.strictEqual(reached.reachReason, "REACHED");
assert.strictEqual(reached.estimatedReachMonth, "2026-10");
assert.ok(reached.points.every((p) => p.savedAmount === "7000.00"));
const cents = calculateSavingsTrajectory(
  [goal({ targetAmount: "1800.01", monthlyContribution: "350.00" })],
  1,
  months(2),
  assumptions,
  "maximum"
);
assert.strictEqual(cents.months[0].selectedTotalContribution, "0.01");
assert.strictEqual(cents.points[1].savedAmount, "1800.01");
assert.strictEqual(decimalMinor(Number.MAX_SAFE_INTEGER), "90071992547409.91");
assert.strictEqual(
  decimalMinor(-Number.MAX_SAFE_INTEGER),
  "-90071992547409.91"
);
assert.throws(() => decimalMinor(Number.MAX_SAFE_INTEGER + 1));
assert.throws(() =>
  calculateSavingsTrajectory(
    [selected],
    1,
    [
      { ...months(1)[0], forecastRemainingMinorUnits: Number.MAX_SAFE_INTEGER },
      { ...months(2)[1], forecastResultMinorUnits: Number.MAX_SAFE_INTEGER },
    ],
    assumptions,
    "maximum"
  )
);
assert.throws(() =>
  calculateSavingsTrajectory(
    [selected],
    1,
    months(1),
    { ...assumptions, monthlySafetyMargin: -1 },
    "reasonable"
  )
);
console.log(
  "Savings trajectory domain: acceptance, carry, allocation, margin, horizon, zero/reached and safe money passed"
);

assert.strictEqual(maximum.months[0].selectedPossibleContribution, "1450.00");
assert.strictEqual(reasonable.months[0].totalPossibleContributions, "800.00");
assert.strictEqual(reasonable.months[0].totalReservedContributions, "800.00");

assert.strictEqual(maximum.months[0].capacityBeforeGoals, "1600.00");
assert.strictEqual(reasonable.months[0].capacityBeforeGoals, "800.00");
const balanced = calc("maximum", months(3, 0, [50000, 50000]));
assert.strictEqual(balanced.months[0].freeSupplement, "0.00");
assert.strictEqual(balanced.months[0].allocatedSupplement, "0.00");
assert.strictEqual(balanced.months[0].fundable, true);
const negative = calc("reasonable", months(3, 0, [0, 0]));
assert.strictEqual(negative.months[0].fundable, false);
assert.strictEqual(negative.months[0].allocatedSupplement, "0.00");
assert.strictEqual(negative.estimatedReachMonth, null);

// Once cumulative arrears are covered, a date becomes estimable again.
const recovered = calc("maximum", months(24, -200000));
assert.strictEqual(recovered.estimatedReachMonth, "2027-03");
const lateFunding = calculateSavingsTrajectory(
  [goal({ targetAmount: "1801.00", monthlyContribution: "350.00" })],
  1,
  months(5, -200000),
  assumptions,
  "planned"
);
assert.strictEqual(lateFunding.scheduledReachMonth, "2026-11");
assert.strictEqual(lateFunding.estimatedReachMonth, "2026-12");
