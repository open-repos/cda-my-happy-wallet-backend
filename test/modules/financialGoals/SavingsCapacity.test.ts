import assert from "assert";
import {
  FinancialGoal,
  FinancialGoalProps,
} from "../../../src/modules/financialGoals/domain";
import {
  calculateSavingsEffort,
  calculateSavingsBalance,
} from "../../../src/modules/financialGoals/domain/SavingsCapacity";

const goal = (props: Partial<FinancialGoalProps> = {}) =>
  FinancialGoal.create({
    id: 1,
    ownerId: 7,
    title: "Voyage",
    targetAmount: "1200.00",
    savedAmount: "300.00",
    monthlyContribution: "150.00",
    currency: "EUR",
    targetDate: "2027-03-15",
    ...props,
  });
const today = "2026-10-19";
for (const [count, expected] of [
  [1, "TENABLE"],
  [2, "TENABLE"],
  [3, "NON_TENABLE"],
] as const) {
  const effort = calculateSavingsEffort(
    Array.from({ length: count }, (_, index) => goal({ id: index + 1 })),
    today
  );
  assert.strictEqual(
    calculateSavingsBalance(
      50000,
      effort.plannedMinorUnits,
      effort.requiredMinorUnits,
      1
    ).sustainability,
    expected
  );
}
const effort = calculateSavingsEffort(
  [
    goal(),
    goal({ id: 2, title: "Matériel", monthlyContribution: "200.00" }),
    goal({ id: 3, monthlyContribution: "0.00" }),
    goal({ id: 4, savedAmount: "1200.00" }),
  ],
  today
);
assert.strictEqual(effort.plannedMinorUnits, 35000);
assert.strictEqual(effort.requiredMinorUnits, 36000);
assert.deepStrictEqual(
  effort.goals.map((item) => [
    item.id,
    item.plannedMinorUnits,
    item.requiredMinorUnits,
    item.gapMinorUnits,
    item.includedInTotals,
  ]),
  [
    [1, 15000, 18000, 3000, true],
    [2, 20000, 18000, -2000, true],
    [3, 0, 18000, 18000, false],
  ]
);
const positive = calculateSavingsBalance(50000, 35000, 36000, 1);
assert.deepStrictEqual(positive, {
  beforeGoalsMinorUnits: 50000,
  afterPlannedMinorUnits: 15000,
  afterRequiredMinorUnits: 14000,
  sustainability: "TENABLE",
});
assert.strictEqual(
  calculateSavingsBalance(36000, 35000, 36000, 1).sustainability,
  "TENDU"
);
assert.strictEqual(
  calculateSavingsBalance(35000, 35000, 36000, 1).sustainability,
  "NON_TENABLE"
);
assert.strictEqual(
  calculateSavingsBalance(-1, 0, 0, 1).sustainability,
  "NON_TENABLE"
);
assert.strictEqual(
  calculateSavingsBalance(70000, 35000, 36000, 2).afterRequiredMinorUnits,
  -2000
);
// Unknown deadlines must not be silently counted as zero required saving.
for (const targetDate of [null, "2026-10-31", "2026-09-01"]) {
  const unknown = calculateSavingsEffort(
    [goal(), goal({ id: 2, targetDate })],
    today
  );
  assert.strictEqual(unknown.requiredMinorUnits, null);
  assert.strictEqual(unknown.unassessableCount, 1);
  assert.strictEqual(
    calculateSavingsBalance(50000, 35000, null, 1).sustainability,
    "INDETERMINE"
  );
  assert.strictEqual(
    calculateSavingsBalance(10000, 35000, null, 1).sustainability,
    "NON_TENABLE"
  );
}
const excluded = calculateSavingsEffort(
  [
    goal({ monthlyContribution: 0, targetDate: null }),
    goal({ savedAmount: "1300.00" }),
  ],
  today
);
assert.strictEqual(excluded.plannedMinorUnits, 0);
assert.strictEqual(excluded.requiredMinorUnits, 0);
assert.strictEqual(excluded.unassessableCount, 0);
assert.throws(() =>
  calculateSavingsBalance(
    Number.MAX_SAFE_INTEGER,
    1,
    Number.MAX_SAFE_INTEGER,
    24
  )
);
assert.throws(() => calculateSavingsBalance(1.5, 0, 0, 1));
assert.throws(() => calculateSavingsBalance(0, -1, 0, 1));
