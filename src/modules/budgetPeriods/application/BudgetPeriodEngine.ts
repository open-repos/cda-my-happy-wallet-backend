import {
  assertCivilDate,
  calculateForecastBudget,
  calculateRealBudget,
  ForecastBudgetSummary,
  monthBounds,
  RealBudgetSummary,
} from "../domain";
import {
  BudgetPeriodRepository,
  BudgetPeriodState,
} from "./BudgetPeriodRepository";

export type BudgetPeriodEngineErrorCode = "INVALID_OWNER_ID" | "FUTURE_PERIOD";

export class BudgetPeriodEngineError extends Error {
  public constructor(public readonly code: BudgetPeriodEngineErrorCode) {
    super(code);
    this.name = "BudgetPeriodEngineError";
  }
}

export type BudgetPeriodSummary = Readonly<{
  period: BudgetPeriodState;
  budget: RealBudgetSummary;
  /** Calculé pour le mois courant seulement; un mois passé est un bilan. */
  forecast: ForecastBudgetSummary | null;
  /** Mois dont le reste est reporté; null avant ou au premier mois d'activité. */
  carryFromMonth: string | null;
}>;

export class BudgetPeriodEngine {
  public constructor(private readonly periods: BudgetPeriodRepository) {}

  public async summarize(
    ownerId: number,
    month: string,
    currency: string,
    today: string
  ): Promise<BudgetPeriodSummary> {
    if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
      throw new BudgetPeriodEngineError("INVALID_OWNER_ID");
    }
    const normalizedCurrency = currency.trim().toUpperCase();
    monthBounds(month);
    assertCivilDate(today);
    const currentMonth = today.slice(0, 7);
    if (month > currentMonth) {
      throw new BudgetPeriodEngineError("FUTURE_PERIOD");
    }

    const { period: resolved, budget } = await this.resolve(
      ownerId,
      month,
      normalizedCurrency,
      today
    );
    let period = resolved;
    const origin = await this.periods.firstActivityMonth(
      ownerId,
      normalizedCurrency
    );
    const carryFromMonth =
      origin != null && month > origin ? shiftMonth(month, -1) : null;

    if (month < currentMonth) {
      if (period.status === "OPEN") {
        period = await this.periods.close(period.id, ownerId, {
          actualIncomeMinorUnits: budget.actualIncomeMinorUnits,
          actualExpenseMinorUnits: budget.actualExpenseMinorUnits,
          realRemainingMinorUnits: budget.realRemainingMinorUnits,
          unresolvedEvents: await this.unresolvedCount(
            ownerId,
            month,
            normalizedCurrency
          ),
        });
      }
      return { period, budget, forecast: null, carryFromMonth };
    }

    const [planned, goalSavingsMinorUnits] = await Promise.all([
      this.periods.plannedMovements(ownerId, month, normalizedCurrency),
      this.periods.goalSavings(ownerId, normalizedCurrency),
    ]);
    return {
      period,
      budget,
      carryFromMonth,
      forecast: calculateForecastBudget({
        real: budget,
        today,
        planned,
        goalSavingsMinorUnits,
      }),
    };
  }

  /**
   * Charge ou ouvre la période, rafraîchit le snapshot fixe du mois courant et
   * calcule le réel en y ajoutant le report du mois précédent.
   */
  private async resolve(
    ownerId: number,
    month: string,
    currency: string,
    today: string
  ): Promise<{ period: BudgetPeriodState; budget: RealBudgetSummary }> {
    const currentMonth = today.slice(0, 7);
    let period = await this.periods.find(ownerId, month, currency);
    if (period == null) {
      const previous = await this.previousClosed(
        ownerId,
        month,
        currency,
        today
      );
      const fixed =
        previous != null && month < currentMonth
          ? {
              incomeMinorUnits: previous.fixedIncomeMinorUnits,
              expenseMinorUnits: previous.fixedExpenseMinorUnits,
            }
          : await this.periods.fixedTotals(ownerId, currency);
      period = await this.periods.open(
        ownerId,
        month,
        currency,
        fixed.incomeMinorUnits,
        fixed.expenseMinorUnits,
        previous?.realRemainingMinorUnits ?? 0
      );
    } else if (period.status === "OPEN" && month === currentMonth) {
      const fixed = await this.periods.fixedTotals(ownerId, currency);
      if (
        fixed.incomeMinorUnits !== period.fixedIncomeMinorUnits ||
        fixed.expenseMinorUnits !== period.fixedExpenseMinorUnits
      ) {
        period = await this.periods.updateOpenFixedSnapshot(
          period.id,
          ownerId,
          fixed.incomeMinorUnits,
          fixed.expenseMinorUnits
        );
      }
    }

    const movements = await this.periods.actualMovements(
      ownerId,
      month,
      currency
    );
    const budget = calculateRealBudget({
      month,
      currency,
      today,
      fixedIncomeMinorUnits: period.fixedIncomeMinorUnits,
      fixedExpenseMinorUnits: period.fixedExpenseMinorUnits,
      carryInMinorUnits: period.carryInMinorUnits,
      movements,
    });
    return { period, budget };
  }

  /**
   * Bilan clôturé du mois précédent, matérialisé si besoin. La chaîne démarre
   * au premier mois d'activité de la devise : avant, aucun report n'existe.
   */
  private async previousClosed(
    ownerId: number,
    month: string,
    currency: string,
    today: string
  ): Promise<BudgetPeriodState | null> {
    const origin = await this.periods.firstActivityMonth(ownerId, currency);
    if (origin == null || month <= origin) return null;
    const previousMonth = shiftMonth(month, -1);
    const { period, budget } = await this.resolve(
      ownerId,
      previousMonth,
      currency,
      today
    );
    if (period.status === "CLOSED") return period;
    return this.periods.close(period.id, ownerId, {
      actualIncomeMinorUnits: budget.actualIncomeMinorUnits,
      actualExpenseMinorUnits: budget.actualExpenseMinorUnits,
      realRemainingMinorUnits: budget.realRemainingMinorUnits,
      unresolvedEvents: await this.unresolvedCount(
        ownerId,
        previousMonth,
        currency
      ),
    });
  }

  private async unresolvedCount(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<number> {
    const planned = await this.periods.plannedMovements(
      ownerId,
      month,
      currency
    );
    return planned.reduce((sum, item) => sum + item.count, 0);
  }
}

const shiftMonth = (month: string, offset: number): string => {
  const index =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + offset;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String(
    (index % 12) + 1
  ).padStart(2, "0")}`;
};
