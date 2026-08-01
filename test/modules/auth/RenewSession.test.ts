import assert from "assert";
import { RenewSession } from "../../../src/modules/auth/renewSession/RenewSession";
import { IRefreshSessionService } from "../../../src/modules/auth/refreshSession/RefreshSessionService.interface";
import { IUserRepository } from "../../../src/modules/user/userRepository.interface";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { FakeTokenService } from "../../fakes/FakeTokenService";

const user = {
  id: 42,
  email: "user@example.com",
  password: "password-hash",
  firstname: "Test",
  lastname: "User",
  role: "USER",
  verified: true,
  resetToken: "sensitive-reset-token",
  resetTokenExpiration: new Date("2026-08-01T12:00:00.000Z"),
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-01-02T00:00:00.000Z"),
};

const isUnauthorized = (error: unknown): boolean =>
  error instanceof ErrorException && error.name === ErrorCode.Unauthorized;

async function runRenewSessionTests() {
  const rotatedTokens: string[] = [];
  const refreshSessionService = {
    verify: () => ({
      id: user.id,
      sessionId: "11111111-1111-4111-8111-111111111111",
      jti: "22222222-2222-4222-8222-222222222222",
    }),
    rotate: async (refreshToken: string) => {
      rotatedTokens.push(refreshToken);
      return { userId: user.id, refreshToken: "rotated.refresh.token" };
    },
  } as unknown as IRefreshSessionService;
  const userRepository = {
    getUserById: async () => user,
  } as unknown as IUserRepository;
  const tokenService = new FakeTokenService();
  const renewSession = new RenewSession(
    userRepository,
    refreshSessionService,
    tokenService,
    "access-token-secret"
  );

  const result = await renewSession.execute(
    "current.refresh.token",
    "user@example.com"
  );

  assert.deepStrictEqual(rotatedTokens, ["current.refresh.token"]);
  assert.strictEqual(result.userId, user.id);
  assert.strictEqual(result.refreshToken, "rotated.refresh.token");
  assert.strictEqual(result.accessToken, "fake.jwt.token");
  assert.strictEqual(result.accessTokenExpires, "5min");
  assert.strictEqual(result.accessTokenExpiresIn, 300);
  assert.deepStrictEqual(result.user, {
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    role: user.role,
    verified: user.verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
  assert.deepStrictEqual(tokenService.signedTokens, [
    {
      payload: { id: user.id },
      secret: "access-token-secret",
      options: { expiresIn: "5min" },
    },
  ]);

  await assert.rejects(
    () => renewSession.execute("another.refresh.token", "other@example.com"),
    isUnauthorized
  );
  assert.deepStrictEqual(rotatedTokens, ["current.refresh.token"]);
}

runRenewSessionTests()
  .then(() => {
    console.log("Renew session tests passed");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
