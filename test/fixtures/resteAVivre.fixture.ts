import { ResteAVivreCalculation } from "../../src/modules/operationsFixes/services/ResteAVivreCalculator";

type OperationAmountFixture = {
  montant: unknown;
};

type ResteAVivreCalculationFixture = {
  charges: OperationAmountFixture[];
  expected: ResteAVivreCalculation;
  revenus: OperationAmountFixture[];
};

export const resteAVivreFixtures = {
  created: {
    idRaV: 1,
  },
  createRequiredResponse: [true] as const,
  existingId: 3,
  updateExistingResponse: [false, 3] as const,
};

export const resteAVivreCalculationFixtures: ResteAVivreCalculationFixture[] = [
  {
    revenus: [{ montant: "1200.50" }, { montant: 300 }],
    charges: [{ montant: "400.25" }, { montant: "99.75" }],
    expected: {
      montantTotalEntree: 1500.5,
      montantTotalDepense: 500,
      montantRaV: 1000.5,
    },
  },
  {
    revenus: [],
    charges: [],
    expected: {
      montantTotalEntree: 0,
      montantTotalDepense: 0,
      montantRaV: 0,
    },
  },
  {
    revenus: [{ montant: { toString: () => "42.75" } }],
    charges: [{ montant: { toString: () => "12.25" } }],
    expected: {
      montantTotalEntree: 42.75,
      montantTotalDepense: 12.25,
      montantRaV: 30.5,
    },
  },
];
