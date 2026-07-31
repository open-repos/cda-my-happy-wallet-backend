import assert from "assert";
import { NewPasswordUser } from "../../../src/modules/user/useCases/newPasswordUser/newPasswordUser";
import { TokenNewPasswordUser } from "../../../src/modules/user/useCases/tokenNewPasswordUser/tokennewPasswordUser";
import { IUserRepository } from "../../../src/modules/user/userRepository.interface";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const validToken = "b".repeat(128);

class ResetTokenRepository {
  public valid = true;
  public validityChecks = 0;
  public passwordUpdates = 0;
  public lastToken: string | null = null;

  public async hasValidResetToken(token: string): Promise<boolean> {
    this.validityChecks += 1;
    this.lastToken = token;
    return this.valid;
  }

  public async newPassword(_: string, token: string): Promise<{ count: number }> {
    this.passwordUpdates += 1;
    this.lastToken = token;
    return { count: 1 };
  }
}

const asUserRepository = (repository: ResetTokenRepository): IUserRepository =>
  repository as unknown as IUserRepository;

const isUnauthorized = (error: unknown): boolean =>
  error instanceof ErrorException && error.name === ErrorCode.Unauthorized;

async function runPasswordResetSecurityTests() {
  const malformedRepository = new ResetTokenRepository();
  const malformedTokenUseCase = new TokenNewPasswordUser(
    asUserRepository(malformedRepository)
  );

  await assert.rejects(
    () => malformedTokenUseCase.execute("not-a-reset-token"),
    isUnauthorized
  );
  assert.strictEqual(malformedRepository.validityChecks, 0);

  const expiredRepository = new ResetTokenRepository();
  expiredRepository.valid = false;
  await assert.rejects(
    () =>
      new TokenNewPasswordUser(asUserRepository(expiredRepository)).execute(
        validToken
      ),
    isUnauthorized
  );
  assert.strictEqual(expiredRepository.validityChecks, 1);

  const missingCookieRepository = new ResetTokenRepository();
  await assert.rejects(
    () =>
      new NewPasswordUser(asUserRepository(missingCookieRepository)).execute(
        "NewPassword!1",
        undefined
      ),
    isUnauthorized
  );
  assert.strictEqual(missingCookieRepository.passwordUpdates, 0);

  const invalidRepository = new ResetTokenRepository();
  invalidRepository.valid = false;
  await assert.rejects(
    () =>
      new NewPasswordUser(asUserRepository(invalidRepository)).execute(
        "NewPassword!1",
        validToken
      ),
    isUnauthorized
  );
  assert.strictEqual(invalidRepository.validityChecks, 1);
  assert.strictEqual(invalidRepository.passwordUpdates, 0);

  const validRepository = new ResetTokenRepository();
  const result = await new NewPasswordUser(
    asUserRepository(validRepository)
  ).execute("NewPassword!1", validToken);

  assert.strictEqual(result.success, true);
  assert.strictEqual(validRepository.validityChecks, 1);
  assert.strictEqual(validRepository.passwordUpdates, 1);
  assert.strictEqual(validRepository.lastToken, validToken);
}

runPasswordResetSecurityTests();
