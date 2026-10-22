import {
  decimalHundredths,
  FixedChargeAmount,
  personalChargeMinorUnits,
} from "./fixedChargeAmounts";

type OperationAmount = FixedChargeAmount;

export type ResteAVivreCalculation = {
  montantRaV: number;
  montantTotalDepense: number;
  montantTotalEntree: number;
};

export class ResteAVivreCalculator {
  public static calculate(
    revenus: OperationAmount[],
    charges: OperationAmount[]
  ): ResteAVivreCalculation {
    const expense = charges.reduce(
      (total, charge) => total + personalChargeMinorUnits(charge),
      0
    );
    const income = revenus.reduce(
      (total, revenu) => total + decimalHundredths(revenu.montant),
      0
    );

    return {
      montantRaV: (income - expense) / 100,
      montantTotalDepense: expense / 100,
      montantTotalEntree: income / 100,
    };
  }
}
