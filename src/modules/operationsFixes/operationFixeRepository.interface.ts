import { TypeOperationFixeEnum } from "@prisma/client";
import { OperationFixeProps } from "../../utils/validators/operationFixe.validator";

export interface OperationFixeWithIdProps extends OperationFixeProps {
  id: number;
}

export type ReadOperationFixeProps = {
  id: number;
};

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
  getAllOperationsFixes(userId: string): Promise<any>;
  getAllCharges(
    userId: string,
    typeOperationFixe: TypeOperationFixeEnum
  ): Promise<any>;
  getAllRevenus(
    userId: string,
    typeOperationFixe: TypeOperationFixeEnum
  ): Promise<any>;
  exists(idOperationFixe: number, idUser: number): Promise<boolean>;
  updateRaV(userId: string, idRaV: number): Promise<any>;
  createRaV(userId: string): Promise<any>;
  updateOrCreateRaV(userId: string): Promise<any>;
}
