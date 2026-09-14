import { TypeOperationFixeEnum } from "@prisma/client";
import { OperationFixeProps } from "../../utils/validators/operationFixe.validator";
import { CursorPage, PaginationRequest } from "../pagination";

export interface OperationFixeWithIdProps extends OperationFixeProps {
  id: number;
}

export type ReadOperationFixeProps = {
  id: number;
};

export type OperationFixeListItem = Readonly<{
  idOperationFixe: number;
  titre: string;
  montant: unknown;
  devise: string | null;
  typeOperation: TypeOperationFixeEnum;
}>;

export interface IOperationFixeRepository {
  create(
    operationProps: OperationFixeProps,
    userId: string,
    typeOperationFixe: string
  ): Promise<any>;
  read(
    operationProps: ReadOperationFixeProps,
    userId: string,
    idOperation: string,
    typeOperationFixe: string
  ): Promise<any>;
  update(
    operationProps: OperationFixeWithIdProps,
    userId: string,
    idOperationFixe: string,
    typeOperationFixe: string
  ): Promise<any>;
  delete(
    operationProps: OperationFixeWithIdProps,
    userId: string,
    idOperationFixe: string,
    typeOperationFixe: string
  ): Promise<any>;
  getAllOperationsFixes(
    userId: string,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationFixeListItem>>;
  getAllCharges(
    userId: string,
    typeOperationFixe: TypeOperationFixeEnum,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationFixeListItem>>;
  getAllRevenus(
    userId: string,
    typeOperationFixe: TypeOperationFixeEnum,
    pagination: PaginationRequest
  ): Promise<CursorPage<OperationFixeListItem>>;
  exists(idOperationFixe: number, idUser: number): Promise<boolean>;
  updateRaV(userId: string, idRaV: number): Promise<any>;
  createRaV(userId: string): Promise<any>;
  updateOrCreateRaV(userId: string): Promise<any>;
}
