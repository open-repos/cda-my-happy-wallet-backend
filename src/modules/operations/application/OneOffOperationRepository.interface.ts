import { OneOffOperation, OneOffOperationKind } from "../domain";
import { CursorPage, PaginationRequest } from "../../pagination";

/**
 * Filtres facultatifs d'une liste d'opérations, combinés en ET. Les bornes
 * civiles et de montant sont inclusives ; `categoryIds` est un OU trié et sans
 * doublon ; `title` est un texte contenu, insensible à la casse et aux accents.
 */
export type OperationListFilter = Readonly<{
  from?: string;
  to?: string;
  currency?: string;
  title?: string;
  categoryIds?: readonly number[];
  kind?: OneOffOperationKind;
  minAmount?: string;
  maxAmount?: string;
}>;

export type OperationSortField = "date" | "title" | "category" | "amount";

/** Tri explicite ; absent, la liste garde l'ordre date puis id décroissants. */
export type OperationListSort = Readonly<{
  field: OperationSortField;
  order: "asc" | "desc";
}>;

export type OperationReconciliationInput = Readonly<{
  occurrenceId: number | null;
  expectedOccurrenceId: number | null;
}>;
export interface OneOffOperationRepository {
  listByOwner(
    ownerId: number,
    pagination: PaginationRequest,
    filter?: OperationListFilter,
    sort?: OperationListSort
  ): Promise<CursorPage<OneOffOperation>>;
  /**
   * Libellés distincts du propriétaire, de A à Z, regroupés selon le
   * classement de la base : les variantes à la casse ou aux accents près ne
   * donnent qu'une suggestion. `query` est un texte contenu, sans joker.
   */
  listTitleSuggestions(
    ownerId: number,
    pagination: PaginationRequest,
    query?: string
  ): Promise<CursorPage<string>>;
  findById(id: number, ownerId: number): Promise<OneOffOperation | null>;
  create(
    operation: OneOffOperation,
    reconciliation?: OperationReconciliationInput
  ): Promise<OneOffOperation>;
  update(
    operation: OneOffOperation,
    reconciliation?: OperationReconciliationInput
  ): Promise<OneOffOperation | null>;
  delete(id: number, ownerId: number): Promise<boolean>;
}
