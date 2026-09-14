import assert from "assert";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import { RefreshSessionService } from "../../../src/modules/auth/refreshSession/RefreshSessionService";
import {
  CreateRefreshSessionProps,
  IRefreshSessionRepository,
  RotateRefreshSessionProps,
} from "../../../src/modules/auth/refreshSession/RefreshSessionRepository.interface";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import { Login } from "../../../src/modules/user/useCases/login/login";
import { IUserRepository } from "../../../src/modules/user/userRepository.interface";
import { IRefreshSessionService } from "../../../src/modules/auth/refreshSession/RefreshSessionService.interface";
import { FakeTokenService } from "../../fakes/FakeTokenService";

const secret = "refresh-session-service-test-secret";
const sessionId = "11111111-1111-4111-8111-111111111111";
const firstTokenId = "22222222-2222-4222-8222-222222222222";
const secondTokenId = "33333333-3333-4333-8333-333333333333";
const replayTokenId = "44444444-4444-4444-8444-444444444444";
const fixedNow = new Date("2026-07-31T20:00:00.000Z");

class InMemoryRefreshSessionRepository implements IRefreshSessionRepository {
  public session: CreateRefreshSessionProps | null = null;
  public revoked = false;

  public async create(props: CreateRefreshSessionProps): Promise<void> {
    this.session = props;
  }

  public async rotate(props: RotateRefreshSessionProps): Promise<boolean> {
    if (
      this.session == null ||
      this.revoked ||
      this.session.id !== props.id ||
      this.session.userId !== props.userId ||
      this.session.tokenHash !== props.currentTokenHash ||
      this.session.expiresAt < fixedNow
    ) {
      return false;
    }

    this.session = {
      ...this.session,
      tokenHash: props.nextTokenHash,
      expiresAt: props.nextExpiresAt,
    };
    return true;
  }

  public async revoke(id: string, userId: number): Promise<void> {
    if (this.session?.id === id && this.session.userId === userId) {
      this.revoked = true;
    }
  }
}

const hash = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const isUnauthorized = (error: unknown): boolean =>
  error instanceof ErrorException && error.name === ErrorCode.Unauthorized;

async function runRefreshSessionServiceTests() {
  const repository = new InMemoryRefreshSessionRepository();
  const generatedIds = [sessionId, firstTokenId, secondTokenId, replayTokenId];
  const service = new RefreshSessionService(
    repository,
    undefined,
    secret,
    () => fixedNow,
    () => {
      const id = generatedIds.shift();
      if (id == null) {
        throw new Error("No deterministic UUID available");
      }
      return id;
    }
  );

  const firstToken = await service.issue(42);
  const firstPayload = service.verify(firstToken);

  assert.deepStrictEqual(firstPayload, { id: 42, sessionId, jti: firstTokenId });
  assert.strictEqual(repository.session?.tokenHash, hash(firstToken));
  assert.strictEqual(
    repository.session?.expiresAt.toISOString(),
    "2026-07-31T20:15:00.000Z"
  );

  const rotation = await service.rotate(firstToken);
  assert.strictEqual(rotation.userId, 42);
  assert.notStrictEqual(rotation.refreshToken, firstToken);
  assert.deepStrictEqual(service.verify(rotation.refreshToken), {
    id: 42,
    sessionId,
    jti: secondTokenId,
  });
  assert.strictEqual(repository.session?.tokenHash, hash(rotation.refreshToken));

  await assert.rejects(() => service.rotate(firstToken), isUnauthorized);
  assert.strictEqual(repository.revoked, true);

  const legacyToken = jwt.sign({ id: 42 }, secret, { expiresIn: "15min" });
  assert.throws(() => service.verify(legacyToken), isUnauthorized);

  const password = "Password!1";
  const issuedUserIds: number[] = [];
  const loginRefreshService = {
    async issue(userId: number) {
      issuedUserIds.push(userId);
      return "persisted.refresh.token";
    },
  } as unknown as IRefreshSessionService;
  const loginRepository = {
    async getUserByEmail() {
      return {
        id: 42,
        email: "user@example.com",
        password: await argon2.hash(password),
        firstname: "Test",
        lastname: "User",
        role: "USER",
        verified: true,
        resetToken: null,
        resetTokenExpiration: null,
        created_at: fixedNow,
        updated_at: fixedNow,
      };
    },
    async isUserAccountVerified() {
      return true;
    },
  } as unknown as IUserRepository;
  const login = new Login(
    loginRepository,
    loginRefreshService,
    new FakeTokenService()
  );
  const loginResult = await login.execute({
    email: "user@example.com",
    password,
  });

  assert.deepStrictEqual(issuedUserIds, [42]);
  assert.strictEqual(loginResult.refreshToken, "persisted.refresh.token");
}

runRefreshSessionServiceTests();
