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

export type BudgetPeriodEngineErrorCode =
  | "INVALID_OWNER_ID"
  | "FUTURE_PERIOD"
  | "CONCURRENT_UPDATE";

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

/** Tentatives de recalcul d'une chaîne de périodes avant `CONCURRENT_UPDATE`. */
export const MAX_RECALCULATION_ATTEMPTS = 5;
const MAX_RETRY_DELAY_MS = 200;

/** Attente avant la tentative `attempt` (à partir de 1). */
export type RecalculationPause = (attempt: number) => Promise<void>;

/**
 * Délai aléatoire et croissant (5 à 25 ms, doublé à chaque tentative, au plus
 * 200 ms) : deux écrivains concurrents se désynchronisent au lieu de se gêner
 * à chaque tentative.
 */
export const jitteredRetryDelay = (
  attempt: number,
  random: () => number = Math.random
): number =>
  Math.min(
    MAX_RETRY_DELAY_MS,
    Math.max(1, Math.round((5 + random() * 20) * 2 ** (attempt - 1)))
  );

const pauseBeforeRetry: RecalculationPause = (attempt) =>
  new Promise((resolve) => setTimeout(resolve, jitteredRetryDelay(attempt)));

export class BudgetPeriodEngine {
  public constructor(
    private readonly periods: BudgetPeriodRepository,
    private readonly pause: RecalculationPause = pauseBeforeRetry
  ) {}

  public async summarize(
    ownerId: number,
    month: string,
    currency: string,
    today: string,
    scenario: import("../../monthlyEvents/domain").BudgetScenario = "standard"
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
      this.periods.plannedMovements(
        ownerId,
        month,
        normalizedCurrency,
        scenario
      ),
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
   * Recalcule les périodes existantes à partir d'un mois passé corrigé : bilans
   * clôturés et reports jusqu'au mois courant. Le snapshot fixe reste figé.
   */
  public async recalculateFrom(
    ownerId: number,
    month: string,
    currency: string,
    today: string
  ): Promise<void> {
    if (month >= today.slice(0, 7)) return;
    for (let attempt = 0; attempt < MAX_RECALCULATION_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await this.pause(attempt);
      if (await this.tryRecalculateFrom(ownerId, month, currency, today)) {
        return;
      }
    }
    throw new BudgetPeriodEngineError("CONCURRENT_UPDATE");
  }

  private async tryRecalculateFrom(
    ownerId: number,
    month: string,
    currency: string,
    today: string
  ): Promise<boolean> {
    const periods = await this.periods.listFrom(ownerId, currency, month);
    for (const period of periods) {
      const previous = await this.previousClosed(
        ownerId,
        period.month,
        currency,
        today
      );
      const carryInMinorUnits = previous?.realRemainingMinorUnits ?? 0;
      if (period.status === "OPEN") {
        if (
          carryInMinorUnits !== period.carryInMinorUnits &&
          !(await this.periods.recalculate(
            period.id,
            ownerId,
            period.revision,
            {
              carryInMinorUnits,
            }
          ))
        ) {
          return false;
        }
        continue;
      }
      const budget = calculateRealBudget({
        month: period.month,
        currency,
        today,
        fixedIncomeMinorUnits: period.fixedIncomeMinorUnits,
        fixedExpenseMinorUnits: period.fixedExpenseMinorUnits,
        carryInMinorUnits,
        movements: await this.periods.actualMovements(
          ownerId,
          period.month,
          currency
        ),
      });
      const unchanged =
        carryInMinorUnits === period.carryInMinorUnits &&
        budget.actualIncomeMinorUnits === period.actualIncomeMinorUnits &&
        budget.actualExpenseMinorUnits === period.actualExpenseMinorUnits &&
        budget.realRemainingMinorUnits === period.realRemainingMinorUnits;
      if (
        !unchanged &&
        !(await this.periods.recalculate(period.id, ownerId, period.revision, {
          carryInMinorUnits,
          closedTotals: {
            actualIncomeMinorUnits: budget.actualIncomeMinorUnits,
            actualExpenseMinorUnits: budget.actualExpenseMinorUnits,
            realRemainingMinorUnits: budget.realRemainingMinorUnits,
          },
        }))
      ) {
        return false;
      }
    }
    return true;
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
