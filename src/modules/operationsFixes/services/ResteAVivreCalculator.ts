type OperationAmount = {
  montant: unknown;
};

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
    const montantTotalDepense = this.sumMontants(charges);
    const montantTotalEntree = this.sumMontants(revenus);

    return {
      montantRaV: montantTotalEntree - montantTotalDepense,
      montantTotalDepense,
      montantTotalEntree,
    };
  }

  private static sumMontants(operations: OperationAmount[]): number {
    return operations.reduce(
      (accumulator: number, current: OperationAmount) =>
        accumulator + parseFloat(String(current.montant)),
      0
    );
  }
}
