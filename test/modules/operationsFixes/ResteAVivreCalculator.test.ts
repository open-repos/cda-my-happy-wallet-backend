import assert from "assert";
import { resteAVivreCalculationFixtures } from "../../fixtures/resteAVivre.fixture";
import { ResteAVivreCalculator } from "../../../src/modules/operationsFixes/services/ResteAVivreCalculator";

for (const fixture of resteAVivreCalculationFixtures) {
  const result = ResteAVivreCalculator.calculate(
    fixture.revenus,
    fixture.charges
  );

  assert.deepStrictEqual(result, fixture.expected);
}
