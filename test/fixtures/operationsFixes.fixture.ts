import { TypeOperationFixeEnum } from "@prisma/client";
import {
  OperationFixeWithIdProps,
  ReadOperationFixeProps,
} from "../../src/modules/operationsFixes/operationFixeRepository.interface";
import { OperationFixeProps } from "../../src/utils/validators/operationFixe.validator";

export const operationFixeFixtures = {
  userId: "42",
  charge: {
    id: 7,
    routeId: "7",
    type: "CHARGE" as TypeOperationFixeEnum,
    input: {
      titre: "Loyer",
      montant: 600,
      devise: "EUR",
    } as OperationFixeProps,
    readProps: {
      id: 7,
    } as ReadOperationFixeProps,
    result: {
      idOperationFixe: 7,
      titre: "Loyer",
      montant: 600,
      devise: "EUR",
    },
    updatedInput: {
      id: 7,
      titre: "Loyer",
      montant: 650,
      devise: "EUR",
    } as OperationFixeWithIdProps,
  },
  revenu: {
    id: 8,
    routeId: "8",
    type: "REVENU" as TypeOperationFixeEnum,
    input: {
      titre: "Salaire",
      montant: 2000,
      devise: "EUR",
    } as OperationFixeProps,
    readProps: {
      id: 8,
    } as ReadOperationFixeProps,
    result: {
      idOperationFixe: 8,
      titre: "Salaire",
      montant: 2000,
      devise: "EUR",
    },
  },
};

export const operationFixeListFixtures = {
  charge: {
    ...operationFixeFixtures.charge.result,
    typeOperation: operationFixeFixtures.charge.type,
  },
  revenu: {
    ...operationFixeFixtures.revenu.result,
    typeOperation: operationFixeFixtures.revenu.type,
  },
};
