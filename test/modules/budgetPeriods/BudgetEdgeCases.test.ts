import assert from "assert";
import {
  calculateForecastBudget,
  calculateRealBudget,
  monthBounds,
} from "../../../src/modules/budgetPeriods/domain";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import { MonthlyEvent } from "../../../src/modules/monthlyEvents/domain";
import { civilDateIn } from "../../../src/utils/civilDateClock";

const empty = (month: string, today: string, fixedIncomeMinorUnits = 0) =>
  calculateRealBudget({
    month,
    currency: "EUR",
    today,
    fixedIncomeMinorUnits,
    fixedExpenseMinorUnits: 0,
    movements: [],
  });

// Longueur des mois et années bissextiles, sur deux siècles de bornes.
const lengths: Array<[string, number]> = [
  ["2027-02", 28],
  ["2028-02", 29],
  ["2100-02", 28],
  ["2000-02", 29],
  ["2026-04", 30],
  ["2026-12", 31],
];
for (const [month, days] of lengths) {
  assert.strictEqual(monthBounds(month).days, days, month);
  const summary = empty(month, `${month}-01`);
  assert.strictEqual(summary.days.length, days, month);
  assert.strictEqual(summary.remainingDays, days, month);
  assert.strictEqual(summary.days[days - 1].date, monthBounds(month).end);
}
// Jamais plus de 31 points, quel que soit le mois.
for (let monthNumber = 1; monthNumber <= 12; monthNumber += 1) {
  const month = `2028-${String(monthNumber).padStart(2, "0")}`;
  assert.ok(empty(month, `${month}-01`).days.length <= 31);
}

// Dernier jour : un seul jour restant, aucune division par zéro.
assert.strictEqual(empty("2028-02", "2028-02-29", 2500).remainingDays, 1);
assert.strictEqual(
  empty("2028-02", "2028-02-29", 2500).realDailyAllowanceMinorUnits,
  2500
);
// Mois passé : aucun disponible journalier.
assert.strictEqual(empty("2026-09", "2026-10-01").remainingDays, 0);
assert.strictEqual(
  empty("2026-09", "2026-10-01").realDailyAllowanceMinorUnits,
  null
);

// Centimes exacts : 0,10 + 0,20 = 0,30 sans erreur binaire.
const cents = calculateRealBudget({
  month: "2026-10",
  currency: "EUR",
  today: "2026-10-01",
  fixedIncomeMinorUnits: 0,
  fixedExpenseMinorUnits: 0,
  movements: [
    { operationDate: "2026-10-01", minorUnits: 10, kind: "ENTREE" },
    { operationDate: "2026-10-01", minorUnits: 20, kind: "ENTREE" },
  ],
});
assert.strictEqual(cents.realRemainingMinorUnits, 30);

// Aucun arrondi cumulatif : 900 € sur 28/29/30/31 jours gardent 90 000 centimes.
for (const month of ["2027-02", "2028-02", "2026-04", "2026-01"]) {
  const summary = empty(month, `${month}-01`, 90000);
  assert.strictEqual(summary.realRemainingMinorUnits, 90000, month);
  assert.strictEqual(
    summary.days[summary.days.length - 1].realRemainingMinorUnits,
    90000
  );
}
assert.strictEqual(
  empty("2027-02", "2027-02-01", 90000).realDailyAllowanceMinorUnits,
  3214
);
assert.strictEqual(
  empty("2028-02", "2028-02-01", 90000).realDailyAllowanceMinorUnits,
  3103
);

// Grands montants acceptés et sommés sans perte.
const large = calculateRealBudget({
  month: "2026-10",
  currency: "EUR",
  today: "2026-10-01",
  fixedIncomeMinorUnits: 9999999999,
  fixedExpenseMinorUnits: 0,
  movements: Array.from({ length: 31 }, (_, index) => ({
    operationDate: `2026-10-${String(index + 1).padStart(2, "0")}`,
    minorUnits: 9999999999,
    kind: "ENTREE" as const,
  })),
});
assert.strictEqual(large.realRemainingMinorUnits, 9999999999 * 32);

// Reste négatif : signe conservé jusqu'au disponible prudent.
const negativeForecast = calculateForecastBudget({
  real: empty("2026-10", "2026-10-29"),
  today: "2026-10-29",
  goalSavingsMinorUnits: 0,
  planned: [
    {
      occurrenceDate: "2026-10-31",
      kind: "DEPENSE",
      minorUnits: 6000,
      count: 1,
    },
  ],
});
assert.strictEqual(negativeForecast.forecastRemainingMinorUnits, -6000);
assert.strictEqual(negativeForecast.prudentDailyAllowanceMinorUnits, -2000);

// Pas de double comptage : une réalisation sort du prévisionnel et entre au réel.
const realized = calculateForecastBudget({
  real: calculateRealBudget({
    month: "2026-10",
    currency: "EUR",
    today: "2026-10-11",
    fixedIncomeMinorUnits: 100000,
    fixedExpenseMinorUnits: 0,
    movements: [
      { operationDate: "2026-10-05", minorUnits: 4780, kind: "DEPENSE" },
    ],
  }),
  today: "2026-10-11",
  goalSavingsMinorUnits: 0,
  planned: [],
});
assert.strictEqual(realized.forecastRemainingMinorUnits, 100000 - 4780);

// Événement en retard : il reste déduit et compté à traiter.
const late = calculateForecastBudget({
  real: empty("2026-10", "2026-10-20", 100000),
  today: "2026-10-20",
  goalSavingsMinorUnits: 0,
  planned: [
    {
      occurrenceDate: "2026-10-05",
      kind: "DEPENSE",
      minorUnits: 5000,
      count: 1,
    },
  ],
});
assert.strictEqual(late.forecastRemainingMinorUnits, 95000);
assert.strictEqual(late.overdueCount, 1);

// Récurrence : ancrage au 31 rabattu sur le dernier jour, sans dérive.
const anchored = MonthlyEvent.create({
  ownerId: 1,
  title: "Fin de mois",
  amount: "1.00",
  currency: "EUR",
  kind: "DEPENSE",
  startDate: "2027-12-31",
  recurrence: "MENSUELLE",
});
assert.deepStrictEqual(
  ["2028-01", "2028-02", "2028-03", "2028-04", "2029-02"].map((month) =>
    anchored.occurrenceIn(month)
  ),
  ["2028-01-31", "2028-02-29", "2028-03-31", "2028-04-30", "2029-02-28"]
);

// Objectif : arrondi au centime et au mois supérieurs, passage d'année.
const goal = FinancialGoal.create({
  ownerId: 1,
  title: "Arrondi",
  targetAmount: "100.01",
  savedAmount: 0,
  monthlyContribution: "50.00",
  currency: "EUR",
  targetDate: "2027-01-31",
}).forecast("2026-11-30");
assert.strictEqual(goal.contributionsNeeded, 3);
assert.strictEqual(goal.estimatedReachMonth, "2027-02");
assert.strictEqual(goal.requiredMonthlyMinorUnits, 5001);

// Fuseaux : la date civile dépend du fuseau métier, jamais de celui du processus.
const instant = new Date("2026-10-31T23:30:00.000Z");
assert.strictEqual(civilDateIn("Europe/Paris", instant), "2026-11-01");
assert.strictEqual(civilDateIn("UTC", instant), "2026-10-31");
assert.strictEqual(
  civilDateIn("Europe/Paris", new Date("2026-03-28T23:30:00.000Z")),
  "2026-03-29"
);
assert.strictEqual(
  civilDateIn("Europe/Paris", new Date("2026-12-31T22:59:59.000Z")),
  "2026-12-31"
);
assert.strictEqual(
  civilDateIn("Europe/Paris", new Date("2026-12-31T23:00:00.000Z")),
  "2027-01-01"
);
const reference = JSON.stringify(empty("2026-10", "2026-10-11", 90000));
for (const zone of ["Pacific/Kiritimati", "America/Los_Angeles", "UTC"]) {
  process.env.TZ = zone;
  assert.strictEqual(
    JSON.stringify(empty("2026-10", "2026-10-11", 90000)),
    reference,
    zone
  );
  assert.strictEqual(anchored.occurrenceIn("2028-02"), "2028-02-29", zone);
  assert.strictEqual(civilDateIn("Europe/Paris", instant), "2026-11-01", zone);
}
