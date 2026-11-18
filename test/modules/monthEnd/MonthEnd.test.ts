import assert from "assert";
import { civilDateIn } from "../../../src/utils/civilDateClock";
import {
  evaluateDecision,
  normalizeDecision,
  transferAdjustments,
  MonthEndError,
  assertDecisionPeriod,
} from "../../../src/modules/monthEnd/domain/MonthEnd";

const empty = { savings: [], coverage: [], exceptionalIncomeMinorUnits: 0 };
const input = {
  ...empty,
  expectedRevision: 0,
  idempotencyKey: "month-end-domain-001",
};
const rejects = (work: () => unknown, code: string) =>
  assert.throws(
    work,
    (error: unknown) => error instanceof MonthEndError && error.code === code
  );

rejects(
  () =>
    assertDecisionPeriod(
      "2026-10",
      "EUR",
      civilDateIn("Europe/Paris", new Date("2026-10-31T22:59:59Z"))
    ),
  "PERIOD_NOT_CLOSED"
);
assertDecisionPeriod(
  "2026-10",
  "EUR",
  civilDateIn("Europe/Paris", new Date("2026-10-31T23:00:00Z"))
);
rejects(
  () => assertDecisionPeriod("2026-13", "EUR", "2027-01-01"),
  "INVALID_MONTH"
);

assert.equal(
  evaluateDecision(15000, {
    ...empty,
    savings: [{ accountId: 1, amountMinorUnits: 10000 }],
  }).carryMinorUnits,
  5000
);
assert.equal(evaluateDecision(-15000, empty).carryMinorUnits, -15000);
assert.equal(
  evaluateDecision(-15000, {
    ...empty,
    coverage: [{ accountId: 1, amountMinorUnits: 7000 }],
    exceptionalIncomeMinorUnits: 5000,
  }).carryMinorUnits,
  -3000
);
// A forgotten expense changes the carry, never the existing allocation.
assert.equal(
  evaluateDecision(12000, {
    ...empty,
    savings: [{ accountId: 1, amountMinorUnits: 10000 }],
  }).carryMinorUnits,
  2000
);
rejects(
  () =>
    normalizeDecision({
      ...input,
      savings: [{ accountId: 1, amountMinorUnits: 1.1 }],
    }),
  "INVALID_DECISION"
);
rejects(
  () =>
    normalizeDecision({
      ...input,
      coverage: [{ accountId: 1, amountMinorUnits: 0 }],
    }),
  "INVALID_DECISION"
);
rejects(
  () =>
    normalizeDecision({
      ...input,
      savings: [
        { accountId: 1, amountMinorUnits: 1 },
        { accountId: 1, amountMinorUnits: 2 },
      ],
    }),
  "INVALID_DECISION"
);
rejects(
  () => normalizeDecision({ ...input, expectedRevision: -1 }),
  "INVALID_DECISION"
);
rejects(
  () => normalizeDecision({ ...input, exceptionalIncomeMinorUnits: -1 }),
  "INVALID_DECISION"
);
rejects(
  () =>
    normalizeDecision({ ...input, exceptionalIncomeMinorUnits: 10000000000 }),
  "INVALID_DECISION"
);
rejects(
  () =>
    normalizeDecision({
      ...input,
      savings: Array.from({ length: 101 }, (_, index) => ({
        accountId: index + 1,
        amountMinorUnits: 1,
      })),
    }),
  "INVALID_DECISION"
);
rejects(() => normalizeDecision({ ...input, userId: 1 }), "INVALID_DECISION");
rejects(
  () =>
    evaluateDecision(10000, {
      ...empty,
      coverage: [{ accountId: 1, amountMinorUnits: 1 }],
    }),
  "INVALID_ALLOCATION"
);
rejects(
  () =>
    evaluateDecision(10000, {
      ...empty,
      savings: [{ accountId: 1, amountMinorUnits: 10001 }],
    }),
  "ALLOCATION_EXCEEDS_RESULT"
);
rejects(
  () =>
    evaluateDecision(-10000, { ...empty, exceptionalIncomeMinorUnits: 10001 }),
  "ALLOCATION_EXCEEDS_RESULT"
);
rejects(
  () => evaluateDecision(0, { ...empty, exceptionalIncomeMinorUnits: 1 }),
  "INVALID_ALLOCATION"
);
const previous = {
  ...empty,
  savings: [{ accountId: 1, amountMinorUnits: 10000 }],
};
assert.deepStrictEqual(transferAdjustments(previous, previous), []);
assert.deepStrictEqual(
  transferAdjustments(previous, {
    ...empty,
    savings: [{ accountId: 1, amountMinorUnits: 7000 }],
  }),
  [
    {
      accountId: 1,
      direction: "FROM_SAVINGS",
      amountMinorUnits: 3000,
      reason: "MONTH_END",
      isCompensation: true,
    },
  ]
);
assert.deepStrictEqual(
  transferAdjustments(empty, {
    ...empty,
    coverage: [{ accountId: 2, amountMinorUnits: 10 }],
  }),
  [
    {
      accountId: 2,
      direction: "FROM_SAVINGS",
      amountMinorUnits: 10,
      reason: "NEGATIVE_COVERAGE",
      isCompensation: false,
    },
  ]
);
assert.equal(
  normalizeDecision({
    ...input,
    savings: [
      { accountId: 3, amountMinorUnits: 10 },
      { accountId: 1, amountMinorUnits: 20 },
    ],
  }).savings[0].accountId,
  1
);
assert.deepStrictEqual(
  transferAdjustments(
    { ...empty, coverage: [{ accountId: 1, amountMinorUnits: 2000 }] },
    empty
  ),
  [
    {
      accountId: 1,
      direction: "TO_SAVINGS",
      amountMinorUnits: 2000,
      reason: "NEGATIVE_COVERAGE",
      isCompensation: true,
    },
  ]
);
console.log(
  "Month-end domain: allocation, correction, validation and compensation passed"
);
