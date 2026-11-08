import { CursorPage, PaginationRequest } from "../../pagination";
import { Transfer } from "../domain/Savings";

export type Account = Readonly<{
  id: number;
  name: string;
  currency: string;
  initialBalanceMinorUnits: number;
  balanceMinorUnits: number;
  archived: boolean;
  goalId: number | null;
}>;
export type Movement = Transfer &
  Readonly<{
    id: number;
    accountId: number;
    currency: string;
    type: "VIREMENT";
  }>;
export type SavingsOccurrence = Readonly<{
  accountId: number;
  goalId: number;
  month: string;
  operationDate: string;
  title: string;
  amountMinorUnits: number;
  currency: string;
}>;
export interface SavingsRepository {
  list(owner: number, page: PaginationRequest): Promise<CursorPage<Account>>;
  get(owner: number, id: number): Promise<Account>;
  create(
    owner: number,
    input: { name: string; currency: string; initialBalanceMinorUnits: number }
  ): Promise<Account>;
  update(
    owner: number,
    id: number,
    input: { name?: string; archived?: boolean }
  ): Promise<Account>;
  linkGoal(owner: number, id: number, goalId: number): Promise<Account>;
  transfer(owner: number, id: number, input: Transfer): Promise<Movement>;
  history(
    owner: number,
    id: number,
    page: PaginationRequest
  ): Promise<CursorPage<Movement>>;
  pending(
    owner: number,
    month: string,
    currency: string,
    page: PaginationRequest
  ): Promise<CursorPage<SavingsOccurrence>>;
  resolve(
    owner: number,
    id: number,
    month: string,
    status: "CONFIRMED" | "CANCELED"
  ): Promise<{ status: "CONFIRMED" | "CANCELED"; movement: Movement | null }>;
}
