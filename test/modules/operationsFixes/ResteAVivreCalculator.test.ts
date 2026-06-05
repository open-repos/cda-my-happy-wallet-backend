import assert from "assert";
import { ResteAVivreCalculator } from "../../../src/modules/operationsFixes/services/ResteAVivreCalculator";

const mixedAmounts = ResteAVivreCalculator.calculate(
  [{ montant: "1200.50" }, { montant: 300 }],
  [{ montant: "400.25" }, { montant: "99.75" }]
);

assert.strictEqual(mixedAmounts.montantTotalEntree, 1500.5);
assert.strictEqual(mixedAmounts.montantTotalDepense, 500);
assert.strictEqual(mixedAmounts.montantRaV, 1000.5);

const emptyAmounts = ResteAVivreCalculator.calculate([], []);

assert.strictEqual(emptyAmounts.montantTotalEntree, 0);
assert.strictEqual(emptyAmounts.montantTotalDepense, 0);
assert.strictEqual(emptyAmounts.montantRaV, 0);

const decimalLikeAmounts = ResteAVivreCalculator.calculate(
  [{ montant: { toString: () => "42.75" } }],
  [{ montant: { toString: () => "12.25" } }]
);

assert.strictEqual(decimalLikeAmounts.montantTotalEntree, 42.75);
assert.strictEqual(decimalLikeAmounts.montantTotalDepense, 12.25);
assert.strictEqual(decimalLikeAmounts.montantRaV, 30.5);
