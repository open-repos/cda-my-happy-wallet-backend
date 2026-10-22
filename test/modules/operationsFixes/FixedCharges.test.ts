import assert from "assert";
import { ResteAVivreCalculator } from "../../../src/modules/operationsFixes/services/ResteAVivreCalculator";
import {
  chargeAmountFields,
  FixedChargePeriodicity,
  personalChargeMinorUnits,
} from "../../../src/modules/operationsFixes/services/fixedChargeAmounts";
import {
  chargeSchema,
  operationFixeSchema,
} from "../../../src/utils/validators/operationFixe.validator";

// Acceptance example: the annual invoice stays 120 €, my share is 50 %, and
// only its monthly cost of 5 € reduces a monthly budget of 1,000 €.
const subscription = {
  montant: "120.00",
  periodicite: "ANNUELLE",
  pourcentagePersonnel: 50,
} as const;
assert.deepStrictEqual(
  ResteAVivreCalculator.calculate([{ montant: "1000.00" }], [subscription]),
  { montantRaV: 995, montantTotalDepense: 5, montantTotalEntree: 1000 }
);

const cases: [FixedChargePeriodicity, number[]][] = [
  ["MENSUELLE", [120000, 60000, 48000]],
  ["BIMESTRIELLE", [60000, 30000, 24000]],
  ["TRIMESTRIELLE", [40000, 20000, 16000]],
  ["SEMESTRIELLE", [20000, 10000, 8000]],
  ["ANNUELLE", [10000, 5000, 4000]],
];
for (const [periodicite, expected] of cases) {
  [100, 50, 40].forEach((pourcentagePersonnel, index) => {
    assert.strictEqual(
      personalChargeMinorUnits({
        montant: "1200.00",
        periodicite,
        pourcentagePersonnel,
      }),
      expected[index]
    );
  });
}
assert.strictEqual(personalChargeMinorUnits({ montant: "123.45" }), 12345);
assert.strictEqual(
  personalChargeMinorUnits({ montant: "123.45", pourcentagePersonnel: 0 }),
  0
);
assert.strictEqual(
  personalChargeMinorUnits({ montant: "0.01", pourcentagePersonnel: 50 }),
  1
);
assert.deepStrictEqual(
  chargeAmountFields({
    montant: "0.11",
    periodicite: "ANNUELLE",
    pourcentagePersonnel: 50,
  }),
  {
    periodicite: "ANNUELLE",
    pourcentagePersonnel: 50,
    montantPersonnel: "0.06",
    montantMensuelPersonnel: "0.00",
  }
);
assert.strictEqual(
  personalChargeMinorUnits({
    montant: "99999999.99",
    pourcentagePersonnel: 100,
  }),
  9999999999
);
assert.strictEqual(
  personalChargeMinorUnits({ montant: "100.00", pourcentagePersonnel: 33.33 }),
  3333
);
const tiny = { montant: "0.01", pourcentagePersonnel: 50 };
assert.strictEqual(
  ResteAVivreCalculator.calculate([], [tiny, tiny]).montantTotalDepense,
  0.02
);

const input = { titre: "Abonnement", montant: 120, devise: "EUR" };
for (const pourcentagePersonnel of [0, 0.01, 33.33, 40, 50, 100]) {
  assert.ifError(
    chargeSchema.validate({ ...input, pourcentagePersonnel }).error
  );
}
for (const pourcentagePersonnel of [-1, 100.01, 33.333, "", null, "texte"]) {
  assert.ok(chargeSchema.validate({ ...input, pourcentagePersonnel }).error);
}
for (const montant of [0, -1, 100000000, 0.001, 12.345]) {
  assert.ok(chargeSchema.validate({ ...input, montant }).error);
}
assert.ifError(chargeSchema.validate({ ...input, montant: "0.01" }).error);
assert.ok(
  chargeSchema.validate({ ...input, periodicite: "HEBDOMADAIRE" }).error
);
assert.deepStrictEqual(
  chargeSchema.validate(input).value,
  input,
  "Omitted PUT fields must not reset a persisted share"
);
assert.ok(
  operationFixeSchema.validate({ ...input, pourcentagePersonnel: 50 }).error,
  "Revenues do not support sharing"
);
console.log("Fixed charge acceptance, money and validation tests passed");
