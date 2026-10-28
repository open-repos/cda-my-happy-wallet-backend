import { CursorPage, PaginationRequest } from "../../pagination";
import { BudgetMovement, PlannedMovement } from "../domain";

export type BudgetPeriodState = Readonly<{
  id: number;
  ownerId: number;
  month: string;
  currency: string;
  status: "OPEN" | "CLOSED";
  fixedIncomeMinorUnits: number;
  fixedExpenseMinorUnits: number;
  actualIncomeMinorUnits: number;
  actualExpenseMinorUnits: number;
  realRemainingMinorUnits: number;
  carryInMinorUnits: number;
  unresolvedEvents: number;
  revision: number;
  reconciliationAdjustmentMinorUnits?: number;
  closedAt: Date | null;
  correctedAt: Date | null;
}>;

/** Valeurs recalculées d'une période; les totaux réels ne concernent qu'un bilan clôturé. */
export type RecalculatedPeriod = Readonly<{
  carryInMinorUnits: number;
  closedTotals?: Readonly<{
    actualIncomeMinorUnits: number;
    actualExpenseMinorUnits: number;
    realRemainingMinorUnits: number;
  }>;
}>;

export type CloseBudgetPeriodInput = Readonly<{
  actualIncomeMinorUnits: number;
  actualExpenseMinorUnits: number;
  realRemainingMinorUnits: number;
  unresolvedEvents: number;
  reconciliationAdjustmentMinorUnits?: number;
}>;

export interface BudgetPeriodRepository {
  /** Remaining variable budget only; fixed plans already belong to the base. */
  envelopeReserve?(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<number>;
  hasReconciliationPlans?(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<boolean>;
  find(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<BudgetPeriodState | null>;
  open(
    ownerId: number,
    month: string,
    currency: string,
    fixedIncomeMinorUnits: number,
    fixedExpenseMinorUnits: number,
    carryInMinorUnits: number
  ): Promise<BudgetPeriodState>;
  updateOpenFixedSnapshot(
    id: number,
    ownerId: number,
    fixedIncomeMinorUnits: number,
    fixedExpenseMinorUnits: number
  ): Promise<BudgetPeriodState>;
  close(
    id: number,
    ownerId: number,
    totals: CloseBudgetPeriodInput
  ): Promise<BudgetPeriodState>;
  fixedTotals(
    ownerId: number,
    currency: string,
    month?: string
  ): Promise<Readonly<{ incomeMinorUnits: number; expenseMinorUnits: number }>>;
  actualMovements(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<readonly BudgetMovement[]>;
  /** Occurrences du mois sans résolution, agrégées par date et sens (≤ 62 lignes). */
  plannedMovements(
    ownerId: number,
    month: string,
    currency: string,
    scenario?: import("../../monthlyEvents/domain").BudgetScenario
  ): Promise<readonly PlannedMovement[]>;
  /** Périodes de la devise à partir d'un mois inclus, de la plus ancienne à la plus récente. */
  listFrom(
    ownerId: number,
    currency: string,
    month: string
  ): Promise<readonly BudgetPeriodState[]>;
  /**
   * Écrit un recalcul si la révision n'a pas changé; renvoie false sinon.
   * Incrémente la révision et date la correction d'un bilan clôturé.
   */
  recalculate(
    id: number,
    ownerId: number,
    expectedRevision: number,
    values: RecalculatedPeriod
  ): Promise<boolean>;
  /** Premier mois `YYYY-MM` portant une opération ponctuelle dans la devise. */
  firstActivityMonth(ownerId: number, currency: string): Promise<string | null>;
  /** Bilans clôturés d'une devise, du plus récent au plus ancien. */
  listClosed(
    ownerId: number,
    currency: string,
    page: PaginationRequest
  ): Promise<CursorPage<BudgetPeriodState>>;
  /** Somme des versements mensuels des objectifs non atteints dans la devise. */
  goalSavings(ownerId: number, currency: string): Promise<number>;
}
