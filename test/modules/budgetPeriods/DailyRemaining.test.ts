import assert from "assert";
import {
  calculateForecastBudget,
  calculateRealBudget,
  PlannedMovement,
} from "../../../src/modules/budgetPeriods/domain";

// #179 : reste à vivre cumulé du jour, au prorata du mois.
// valeur(d) = (base ÷ jours) × d − dépenses jusqu'à d + entrées jusqu'à d,
// opérations saisies et événements prévus confondus ; base = revenus fixes
// − charges fixes, sans report, épargne d'objectifs ni réserve d'enveloppes.

type Movement = Parameters<typeof calculateRealBudget>[0]["movements"][number];

const daily = ({
  month,
  income,
  expense = 0,
  movements = [],
  planned = [],
  carryIn = 0,
}: {
  month: string;
  income: number;
  expense?: number;
  movements?: readonly Movement[];
  planned?: readonly PlannedMovement[];
  carryIn?: number;
}) =>
  calculateForecastBudget({
    real: calculateRealBudget({
      month,
      currency: "EUR",
      today: `${month}-01`,
      fixedIncomeMinorUnits: income,
      fixedExpenseMinorUnits: expense,
      carryInMinorUnits: carryIn,
      movements,
    }),
    today: `${month}-01`,
    planned,
    goalSavingsMinorUnits: 1500,
    envelopeReserveMinorUnits: 2000,
  }).days.map((day) => day.dailyRemainingMinorUnits);

const spend = (date: string, minorUnits: number): Movement => ({
  operationDate: date,
  minorUnits,
  kind: "DEPENSE",
});

// Exemple validé par le propriétaire : 90 € sur 30 jours, soit 3 € par jour ;
// trois dépenses de 10 € les jours 2, 10 et 20. Le report de 50 €, l'épargne
// et la réserve d'enveloppes n'entrent pas dans la valeur.
const example = daily({
  month: "2026-11",
  income: 12000,
  expense: 3000,
  carryIn: 5000,
  movements: [
    spend("2026-11-02", 1000),
    spend("2026-11-10", 1000),
    spend("2026-11-20", 1000),
  ],
});
assert.strictEqual(example.length, 30);
const at = (values: readonly number[], day: number) => values[day - 1];
assert.strictEqual(at(example, 1), 300);
assert.strictEqual(at(example, 2), -400);
assert.strictEqual(at(example, 3), -100);
assert.strictEqual(at(example, 9), 1700);
assert.strictEqual(at(example, 10), 1000);
assert.strictEqual(at(example, 19), 3700);
assert.strictEqual(at(example, 20), 3000);
assert.strictEqual(at(example, 30), 6000);

// Événements prévus : comptés le jour où ils tombent, comme une opération
// saisie ce jour-là ; une entrée prévue s'ajoute. Une entrée saisie aussi.
const withEvents = daily({
  month: "2026-11",
  income: 9000,
  movements: [
    spend("2026-11-02", 1000),
    { operationDate: "2026-11-04", minorUnits: 500, kind: "ENTREE" },
  ],
  planned: [
    {
      occurrenceDate: "2026-11-25",
      kind: "DEPENSE",
      minorUnits: 2000,
      count: 2,
    },
    { occurrenceDate: "2026-11-05", kind: "ENTREE", minorUnits: 700, count: 1 },
  ],
});
assert.strictEqual(at(withEvents, 4), 1200 - 1000 + 500);
assert.strictEqual(at(withEvents, 5), 1500 - 1000 + 500 + 700);
assert.strictEqual(at(withEvents, 24), 7200 - 1000 + 500 + 700);
assert.strictEqual(at(withEvents, 25), 7500 - 1000 + 500 + 700 - 2000);
assert.strictEqual(at(withEvents, 30), 9000 - 1000 + 500 + 700 - 2000);

// Arrondi : 100 € sur 30 jours, 3,33 € par jour ; le reste de la division est
// porté sur le dernier jour, qui tombe juste.
const rounded = daily({ month: "2026-11", income: 10000 });
assert.strictEqual(at(rounded, 1), 333);
assert.strictEqual(at(rounded, 29), 333 * 29);
assert.strictEqual(at(rounded, 30), 10000);

// Mois de 28, 29 et 31 jours : le dernier jour égale toujours la base.
for (const [month, days] of [
  ["2027-02", 28],
  ["2028-02", 29],
  ["2026-10", 31],
] as const) {
  const values = daily({ month, income: 10000 });
  assert.strictEqual(values.length, days, month);
  assert.strictEqual(values[0], Math.trunc(10000 / days), month);
  assert.strictEqual(values[days - 1], 10000, month);
}

// Base négative : la part du jour est tronquée vers zéro, le dernier jour
// tombe juste.
const negative = daily({ month: "2026-11", income: 0, expense: 1000 });
assert.strictEqual(at(negative, 1), -33);
assert.strictEqual(at(negative, 30), -1000);

// Une dépense rapprochée d'une charge fixe d'enveloppe est déjà comptée dans
// la base : elle ne puise pas une seconde fois dans le reste du jour.
const reconciled = daily({
  month: "2026-11",
  income: 90000,
  expense: 30000,
  movements: [
    {
      ...spend("2026-11-03", 20000),
      fixedReconciliation: { occurrenceId: 7, plannedMinorUnits: 30000 },
    },
  ],
});
assert.strictEqual(at(reconciled, 3), 2000 * 3);
assert.strictEqual(at(reconciled, 30), 60000);

// La part ne suit que le socle : une charge fixe modifiée la recalcule, une
// opération ponctuelle non. Opérations du premier et du dernier jour.
const before = daily({
  month: "2026-11",
  income: 9000,
  movements: [spend("2026-11-01", 100), spend("2026-11-30", 200)],
});
const moreCharges = daily({
  month: "2026-11",
  income: 9000,
  expense: 3000,
  movements: [spend("2026-11-01", 100), spend("2026-11-30", 200)],
});
assert.strictEqual(at(before, 1), 300 - 100);
assert.strictEqual(at(before, 29), 300 * 29 - 100);
assert.strictEqual(at(before, 30), 9000 - 300);
assert.strictEqual(at(moreCharges, 1), 200 - 100);
assert.strictEqual(at(moreCharges, 30), 6000 - 300);
const withoutOperations = daily({ month: "2026-11", income: 9000 });
for (let day = 1; day <= 30; day += 1)
  assert.strictEqual(
    at(before, day) - at(withoutOperations, day),
    day === 30 ? -300 : -100,
    `jour ${day}`
  );

console.log("Daily prorated remaining tests passed");
