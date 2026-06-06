import assert from "assert";
import { TypeOperationFixeEnum } from "@prisma/client";
import { FakeTokenService } from "../fakes/FakeTokenService";
import { CreateOperationFixe } from "../../src/modules/operationsFixes/useCases/createOperationFixe/createOperationFixe";
import { DeleteOperationFixe } from "../../src/modules/operationsFixes/useCases/deleteOperationFixe/deleteOperationFixe";
import { ReadAllOperationFixe } from "../../src/modules/operationsFixes/useCases/readAllOperationFixe/readAllOperationFixe";
import { ReadOperationFixe } from "../../src/modules/operationsFixes/useCases/readOperationFixe/readOperationFixe";
import { UpdateOperationFixe } from "../../src/modules/operationsFixes/useCases/updateOperationFixe/updateOperationFixe";
import {
  IOperationFixeRepository,
  OperationFixeWithIdProps,
  ReadOperationFixeProps,
} from "../../src/modules/operationsFixes/operationFixeRepository.interface";
import { ConfirmRegistrationUser } from "../../src/modules/user/useCases/confirmRegistrationUser/confirmRegistrationUser";
import { DeleteAccount } from "../../src/modules/user/useCases/deleteAccount/deleteAccount";
import { NewPasswordUser } from "../../src/modules/user/useCases/newPasswordUser/newPasswordUser";
import { ResetPasswordUser } from "../../src/modules/user/useCases/resetPasswordUser/resetPasswordUser";
import { IUserRepository } from "../../src/modules/user/userRepository.interface";
import { createUserProps } from "../../src/utils/validators/register.validator";
import { OperationFixeProps } from "../../src/utils/validators/operationFixe.validator";

class FakeOperationFixeRepository implements IOperationFixeRepository {
  public calls: string[] = [];
  public lastDeleteIdOperationFixe: string | null = null;
  public lastDeletePropsId: number | null = null;
  public lastExistsId: number | null = null;
  public updateExistingRaV = false;

  public async create(
    _operationProps: OperationFixeProps,
    _userId: string,
    _typeOperationFixe: string
  ): Promise<any> {
    this.calls.push("create");
    return {
      idOperationFixe: 7,
      titre: "Loyer",
      montant: 600,
      devise: "EUR",
      ignored: true,
    };
  }

  public async read(
    _operationProps: ReadOperationFixeProps,
    _userId: string,
    _idOperation: string,
    _typeOperationFixe: string
  ): Promise<any> {
    this.calls.push("read");
    return [
      {
        idOperationFixe: 7,
        titre: "Loyer",
        montant: 600,
        devise: "EUR",
      },
    ];
  }

  public async update(
    _operationProps: OperationFixeWithIdProps,
    _userId: string,
    _idOperationFixe: string,
    _typeOperationFixe: string
  ): Promise<any> {
    this.calls.push("update");
    return { count: 1 };
  }

  public async delete(
    operationProps: OperationFixeWithIdProps,
    _userId: string,
    idOperationFixe: string,
    _typeOperationFixe: string
  ): Promise<any> {
    this.calls.push("delete");
    this.lastDeleteIdOperationFixe = idOperationFixe;
    this.lastDeletePropsId = operationProps.id;
    return { count: 1 };
  }

  public async getAllOperationsFixes(_userId: string): Promise<any> {
    this.calls.push("getAllOperationsFixes");
    return [
      {
        idOperationFixe: 7,
        titre: "Loyer",
        montant: 600,
        devise: "EUR",
        typeOperation: "CHARGE",
      },
    ];
  }

  public async getAllCharges(
    _userId: string,
    _typeOperationFixe: TypeOperationFixeEnum
  ): Promise<any> {
    this.calls.push("getAllCharges");
    return [];
  }

  public async getAllRevenus(
    _userId: string,
    _typeOperationFixe: TypeOperationFixeEnum
  ): Promise<any> {
    this.calls.push("getAllRevenus");
    return [
      {
        idOperationFixe: 8,
        titre: "Salaire",
        montant: 2000,
        devise: "EUR",
        typeOperation: "REVENU",
      },
    ];
  }

  public async exists(
    idOperationFixe: number,
    _idUser: number
  ): Promise<boolean> {
    this.calls.push("exists");
    this.lastExistsId = idOperationFixe;
    return true;
  }

  public async updateRaV(_userId: string, _idRaV: number): Promise<any> {
    this.calls.push("updateRaV");
    return { count: 1 };
  }

  public async createRaV(_userId: string): Promise<any> {
    this.calls.push("createRaV");
    return { idRaV: 1 };
  }

  public async updateOrCreateRaV(_userId: string): Promise<any> {
    this.calls.push("updateOrCreateRaV");
    return this.updateExistingRaV ? ([false, 3] as const) : ([true] as const);
  }
}

class FakeUserRepository implements IUserRepository {
  public calls: string[] = [];
  public lastResetToken: string | null = null;
  public lastNewPassword: string | null = null;

  public async create(_userProps: createUserProps): Promise<any> {
    this.calls.push("create");
    return { id: 42 };
  }

  public async delete(_email: string, _userId: number): Promise<any> {
    this.calls.push("delete");
    return { count: 1 };
  }

  public async resetPassword(
    _email: string,
    resetToken: string,
    _resetTokenExpiration: Date
  ): Promise<any> {
    this.calls.push("resetPassword");
    this.lastResetToken = resetToken;
    return { id: 42 };
  }

  public async newPassword(
    newpassword: string,
    _resetToken: string
  ): Promise<any> {
    this.calls.push("newPassword");
    this.lastNewPassword = newpassword;
    return { count: 1 };
  }

  public async confirmRegistration(_id: string): Promise<any> {
    this.calls.push("confirmRegistration");
    return { id: 42, verified: true };
  }

  public async exists(_email: string): Promise<boolean> {
    this.calls.push("exists");
    return true;
  }

  public async getUserByEmail(_email: string): Promise<any> {
    this.calls.push("getUserByEmail");
    return { id: 42 };
  }

  public async getUserById(_id: number): Promise<any> {
    this.calls.push("getUserById");
    return { id: 42 };
  }

  public async existUserResetToken(_resetToken: string): Promise<boolean> {
    this.calls.push("existUserResetToken");
    return true;
  }

  public async isUserAccountVerified(_email: string): Promise<boolean> {
    this.calls.push("isUserAccountVerified");
    return true;
  }

  public async sendMail(
    _email: string,
    _subject: string,
    _text: string
  ): Promise<boolean> {
    this.calls.push("sendMail");
    return true;
  }
}

async function runOperationFixeResultTests() {
  const repository = new FakeOperationFixeRepository();
  const createUseCase = new CreateOperationFixe(repository);
  const [createResult, createRaVResult] = await createUseCase.execute(
    { titre: "Loyer", montant: 600, devise: "EUR" },
    "42",
    "CHARGE" as TypeOperationFixeEnum
  );

  assert.deepStrictEqual(createResult, {
    success: true,
    message: "CHARGE Successfully Created",
    data: {
      idOperationFixe: 7,
      titre: "Loyer",
      montant: 600,
      devise: "EUR",
    },
  });
  assert.deepStrictEqual(createRaVResult, {
    success: true,
    message: "Rest à Vivre Mis à jour Successfully Created",
    data: null,
  });
  assert.deepStrictEqual(repository.calls, [
    "create",
    "updateOrCreateRaV",
    "createRaV",
  ]);

  const readResult = await new ReadOperationFixe(repository).execute(
    { id: 7 },
    "42",
    "7",
    "CHARGE"
  );
  assert.deepStrictEqual(readResult, {
    success: true,
    message: "CHARGE Successfully Read",
    data: [
      {
        idOperationFixe: 7,
        titre: "Loyer",
        montant: 600,
        devise: "EUR",
      },
    ],
  });

  const updateResult = await new UpdateOperationFixe(repository).execute(
    { id: 7, titre: "Loyer", montant: 650, devise: "EUR" },
    "42",
    "7",
    "CHARGE"
  );
  assert.deepStrictEqual(updateResult, {
    success: true,
    message: "CHARGE Successfully Updated",
  });

  const deleteResult = await new DeleteOperationFixe(repository).execute(
    { id: 7, titre: "Loyer", montant: 650, devise: "EUR" },
    "42",
    "7",
    "CHARGE"
  );
  assert.deepStrictEqual(deleteResult, {
    success: true,
    message: "CHARGE Successfully Deleted",
  });

  const deleteRouteIdRepository = new FakeOperationFixeRepository();
  const deleteRouteIdResult = await new DeleteOperationFixe(
    deleteRouteIdRepository
  ).execute({}, "42", "8", "REVENU");
  assert.deepStrictEqual(deleteRouteIdResult, {
    success: true,
    message: "REVENU Successfully Deleted",
  });
  assert.strictEqual(deleteRouteIdRepository.lastExistsId, 8);
  assert.strictEqual(deleteRouteIdRepository.lastDeleteIdOperationFixe, "8");
  assert.strictEqual(deleteRouteIdRepository.lastDeletePropsId, 8);
  assert.deepStrictEqual(deleteRouteIdRepository.calls, ["exists", "delete"]);

  const emptyChargesResult = await new ReadAllOperationFixe(repository).execute(
    "42",
    "CHARGE" as TypeOperationFixeEnum
  );
  assert.deepStrictEqual(emptyChargesResult, {
    success: true,
    message: "All CHARGE Successfully Read",
    data: [],
  });
}

async function runUserResultTests() {
  const repository = new FakeUserRepository();

  const deleteResult = await new DeleteAccount(repository).execute(
    { email: "user@example.com" },
    "42"
  );
  assert.deepStrictEqual(deleteResult, {
    success: true,
    message: "User with user@example.com account Successfully Deleted",
  });

  const confirmResult = await new ConfirmRegistrationUser(
    repository,
    new FakeTokenService({ id: 42 })
  ).execute("42", "fake-register-token");
  assert.deepStrictEqual(confirmResult, {
    success: true,
    message: "Registration User is successfull Successfully Created",
    data: null,
  });

  const resetPasswordResult = await new ResetPasswordUser(repository).execute(
    "user@example.com"
  );
  assert.deepStrictEqual(resetPasswordResult, {
    success: true,
    message:
      "Email to reset password was sent to andria.capai@gmail.com",
    payload: null,
  });
  assert.strictEqual(repository.lastResetToken?.length, 128);

  const newPasswordResult = await new NewPasswordUser(repository).execute(
    "NewPassword!1",
    "reset-token"
  );
  assert.deepStrictEqual(newPasswordResult, {
    success: true,
    message: "New password created Successfully Created",
    payload: null,
  });
  assert.notStrictEqual(repository.lastNewPassword, "NewPassword!1");
}

async function runResultConstructionTests() {
  await runOperationFixeResultTests();
  await runUserResultTests();
}

runResultConstructionTests();
