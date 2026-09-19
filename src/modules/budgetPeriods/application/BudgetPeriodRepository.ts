import { BudgetMovement } from "../domain";

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
  revision: number;
  closedAt: Date | null;
}>;

export type CloseBudgetPeriodInput = Readonly<{
  actualIncomeMinorUnits: number;
  actualExpenseMinorUnits: number;
  realRemainingMinorUnits: number;
}>;

export interface BudgetPeriodRepository {
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
    fixedExpenseMinorUnits: number
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
    currency: string
  ): Promise<Readonly<{ incomeMinorUnits: number; expenseMinorUnits: number }>>;
  actualMovements(
    ownerId: number,
    month: string,
    currency: string
  ): Promise<readonly BudgetMovement[]>;
}
