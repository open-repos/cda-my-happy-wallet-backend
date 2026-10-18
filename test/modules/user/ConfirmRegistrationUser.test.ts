import assert from "assert";
import { ConfirmRegistrationUser } from "../../../src/modules/user/useCases/confirmRegistrationUser/confirmRegistrationUser";
import { IUserRepository } from "../../../src/modules/user/userRepository.interface";
import { createUserProps } from "../../../src/utils/validators/register.validator";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { FakeTokenService } from "../../fakes/FakeTokenService";

class ConfirmationRepository implements IUserRepository {
  private verified = false;
  public confirmationCalls: Array<{ id: string; email: string }> = [];

  public async confirmRegistration(
    id: string,
    email: string
  ): Promise<boolean> {
    this.confirmationCalls.push({ id, email });
    if (this.verified || id !== "42" || email !== "user@example.com") {
      return false;
    }

    this.verified = true;
    return true;
  }

  public async getUserById(id: number): Promise<any> {
    return id === 42 ? { id, email: "user@example.com" } : null;
  }

  public async create(_props: createUserProps): Promise<any> {
    throw new Error("Not used");
  }
  public async delete(): Promise<any> {
    throw new Error("Not used");
  }
  public async resetPassword(): Promise<any> {
    throw new Error("Not used");
  }
  public async newPassword(): Promise<any> {
    throw new Error("Not used");
  }
  public async exists(): Promise<boolean> {
    throw new Error("Not used");
  }
  public async getUserByEmail(): Promise<any> {
    throw new Error("Not used");
  }
  public async hasValidResetToken(): Promise<boolean> {
    throw new Error("Not used");
  }
  public async isUserAccountVerified(): Promise<boolean> {
    throw new Error("Not used");
  }
  public async sendMail(): Promise<boolean> {
    throw new Error("Not used");
  }
}

const hasCode =
  (code: string) =>
  (error: unknown): boolean =>
    error instanceof ErrorException && error.name === code;

async function run() {
  const repository = new ConfirmationRepository();
  const useCase = new ConfirmRegistrationUser(
    repository,
    new FakeTokenService({ email: "user@example.com" })
  );

  const result = await useCase.execute("42", "valid-token");
  assert.strictEqual(result.success, true);
  assert.deepStrictEqual(repository.confirmationCalls, [
    { id: "42", email: "user@example.com" },
  ]);

  await assert.rejects(
    () => useCase.execute("42", "valid-token"),
    hasCode(ErrorCode.Conflict)
  );

  const crossAccountRepository = new ConfirmationRepository();
  const crossAccountUseCase = new ConfirmRegistrationUser(
    crossAccountRepository,
    new FakeTokenService({ email: "another-user@example.com" })
  );
  await assert.rejects(
    () => crossAccountUseCase.execute("42", "cross-account-token"),
    hasCode(ErrorCode.Unauthorized)
  );
  assert.strictEqual(crossAccountRepository.confirmationCalls.length, 0);

  const invalidTokenRepository = new ConfirmationRepository();
  const invalidTokenUseCase = new ConfirmRegistrationUser(
    invalidTokenRepository,
    new FakeTokenService({}, new Error("jwt expired"))
  );
  await assert.rejects(
    () => invalidTokenUseCase.execute("42", "expired-token"),
    hasCode(ErrorCode.Unauthorized)
  );
  assert.strictEqual(invalidTokenRepository.confirmationCalls.length, 0);

  const malformedTokenRepository = new ConfirmationRepository();
  const malformedTokenUseCase = new ConfirmRegistrationUser(
    malformedTokenRepository,
    new FakeTokenService({ subject: "user@example.com" })
  );
  await assert.rejects(
    () => malformedTokenUseCase.execute("42", "malformed-token"),
    hasCode(ErrorCode.Unauthorized)
  );
  assert.strictEqual(malformedTokenRepository.confirmationCalls.length, 0);

  const invalidIdRepository = new ConfirmationRepository();
  const invalidIdUseCase = new ConfirmRegistrationUser(
    invalidIdRepository,
    new FakeTokenService({ email: "user@example.com" })
  );
  await assert.rejects(
    () => invalidIdUseCase.execute("42-not-an-id", "valid-token"),
    hasCode(ErrorCode.Unauthorized)
  );
  assert.strictEqual(invalidIdRepository.confirmationCalls.length, 0);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
