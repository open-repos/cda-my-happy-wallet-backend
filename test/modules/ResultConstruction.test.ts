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
import {
  operationFixeFixtures,
  operationFixeListFixtures,
} from "../fixtures/operationsFixes.fixture";
import { resteAVivreFixtures } from "../fixtures/resteAVivre.fixture";
import { userFixtures } from "../fixtures/users.fixture";

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
      ...operationFixeFixtures.charge.result,
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
    return [operationFixeFixtures.charge.result];
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
    return [operationFixeListFixtures.charge];
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
    return [operationFixeListFixtures.revenu];
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
    return resteAVivreFixtures.created;
  }

  public async updateOrCreateRaV(_userId: string): Promise<any> {
    this.calls.push("updateOrCreateRaV");
    return this.updateExistingRaV
      ? resteAVivreFixtures.updateExistingResponse
      : resteAVivreFixtures.createRequiredResponse;
  }
}

class FakeUserRepository implements IUserRepository {
  public calls: string[] = [];
  public lastResetToken: string | null = null;
  public lastNewPassword: string | null = null;

  public async create(_userProps: createUserProps): Promise<any> {
    this.calls.push("create");
    return { id: userFixtures.id };
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
    return { id: userFixtures.id };
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
    return { id: userFixtures.id, verified: true };
  }

  public async exists(_email: string): Promise<boolean> {
    this.calls.push("exists");
    return true;
  }

  public async getUserByEmail(_email: string): Promise<any> {
    this.calls.push("getUserByEmail");
    return { id: userFixtures.id };
  }

  public async getUserById(_id: number): Promise<any> {
    this.calls.push("getUserById");
    return { id: userFixtures.id };
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
    operationFixeFixtures.charge.input,
    operationFixeFixtures.userId,
    operationFixeFixtures.charge.type
  );

  assert.deepStrictEqual(createResult, {
    success: true,
    message: "CHARGE Successfully Created",
    data: operationFixeFixtures.charge.result,
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
    operationFixeFixtures.charge.readProps,
    operationFixeFixtures.userId,
    operationFixeFixtures.charge.routeId,
    operationFixeFixtures.charge.type
  );
  assert.deepStrictEqual(readResult, {
    success: true,
    message: "CHARGE Successfully Read",
    data: [operationFixeFixtures.charge.result],
  });

  const updateResult = await new UpdateOperationFixe(repository).execute(
    operationFixeFixtures.charge.input,
    operationFixeFixtures.userId,
    operationFixeFixtures.charge.routeId,
    operationFixeFixtures.charge.type
  );
  assert.deepStrictEqual(updateResult, {
    success: true,
    message: "CHARGE Successfully Updated",
  });
  assert.strictEqual(
    repository.lastExistsId,
    operationFixeFixtures.charge.id
  );

  const deleteResult = await new DeleteOperationFixe(repository).execute(
    operationFixeFixtures.charge.updatedInput,
    operationFixeFixtures.userId,
    operationFixeFixtures.charge.routeId,
    operationFixeFixtures.charge.type
  );
  assert.deepStrictEqual(deleteResult, {
    success: true,
    message: "CHARGE Successfully Deleted",
  });

  const deleteRouteIdRepository = new FakeOperationFixeRepository();
  const deleteRouteIdResult = await new DeleteOperationFixe(
    deleteRouteIdRepository
  ).execute(
    {},
    operationFixeFixtures.userId,
    operationFixeFixtures.revenu.routeId,
    operationFixeFixtures.revenu.type
  );
  assert.deepStrictEqual(deleteRouteIdResult, {
    success: true,
    message: "REVENU Successfully Deleted",
  });
  assert.strictEqual(
    deleteRouteIdRepository.lastExistsId,
    operationFixeFixtures.revenu.id
  );
  assert.strictEqual(
    deleteRouteIdRepository.lastDeleteIdOperationFixe,
    operationFixeFixtures.revenu.routeId
  );
  assert.strictEqual(
    deleteRouteIdRepository.lastDeletePropsId,
    operationFixeFixtures.revenu.id
  );
  assert.deepStrictEqual(deleteRouteIdRepository.calls, ["exists", "delete"]);

  const emptyChargesResult = await new ReadAllOperationFixe(repository).execute(
    operationFixeFixtures.userId,
    operationFixeFixtures.charge.type
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
    { email: userFixtures.email },
    userFixtures.idAsString
  );
  assert.deepStrictEqual(deleteResult, {
    success: true,
    message: `User with ${userFixtures.email} account Successfully Deleted`,
  });

  const confirmResult = await new ConfirmRegistrationUser(
    repository,
    new FakeTokenService({ id: userFixtures.id })
  ).execute(userFixtures.idAsString, "fake-register-token");
  assert.deepStrictEqual(confirmResult, {
    success: true,
    message: "Registration User is successfull Successfully Created",
    data: null,
  });

  const resetPasswordResult = await new ResetPasswordUser(repository).execute(
    userFixtures.email
  );
  assert.deepStrictEqual(resetPasswordResult, {
    success: true,
    message:
      "Email to reset password was sent to user@example.com",
    payload: null,
  });
  assert.strictEqual(repository.lastResetToken?.length, 128);

  const newPasswordResult = await new NewPasswordUser(repository).execute(
    userFixtures.newPassword,
    userFixtures.resetToken
  );
  assert.deepStrictEqual(newPasswordResult, {
    success: true,
    message: "New password created Successfully Created",
    payload: null,
  });
  assert.notStrictEqual(repository.lastNewPassword, userFixtures.newPassword);
}

async function runResultConstructionTests() {
  await runOperationFixeResultTests();
  await runUserResultTests();
}

runResultConstructionTests();
