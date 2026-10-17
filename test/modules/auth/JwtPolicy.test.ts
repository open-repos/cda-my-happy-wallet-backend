/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { createHash } from "crypto";
import express from "express";
import supertest from "supertest";
import jwt, { JwtPayload } from "jsonwebtoken";
import {
  ACCESS_TOKEN_SECRET,
  JWT_CONFIGURATION,
  REFRESH_TOKEN_SECRET,
  REGISTER_TOKEN,
} from "../../../src/config/config";
import { JwtPurpose } from "../../../src/config/jwtConfig";
import { tokenJwtTAuth } from "../../../src/middlewares/authenticateToken.middleware";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { JsonWebTokenService } from "../../../src/modules/auth/token/JsonWebTokenService";
import { RefreshSessionService } from "../../../src/modules/auth/refreshSession/RefreshSessionService";
import {
  CreateRefreshSessionProps,
  IRefreshSessionRepository,
  RotateRefreshSessionProps,
} from "../../../src/modules/auth/refreshSession/RefreshSessionRepository.interface";
import { RenewSession } from "../../../src/modules/auth/renewSession/RenewSession";
import { NativeSessionController } from "../../../src/modules/auth/nativeSession/NativeSessionController";
import { Login } from "../../../src/modules/user/useCases/login/login";
import { CreateUser } from "../../../src/modules/user/useCases/createUser/createUser";
import { ConfirmRegistrationUser } from "../../../src/modules/user/useCases/confirmRegistrationUser/confirmRegistrationUser";
import { IUserRepository } from "../../../src/modules/user/userRepository.interface";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";
import argon2 from "argon2";

const secret = "jwt-policy-unit-test-secret-at-least-32-characters";
const purposes: JwtPurpose[] = ["access", "refresh", "registration"];
const unauthorized = (error: unknown) =>
  error instanceof ErrorException && error.name === ErrorCode.Unauthorized;

async function verifyPolicy() {
  for (const purpose of purposes) {
    const service = new JsonWebTokenService(purpose);
    const token = service.sign({ id: 42 }, secret, {
      expiresIn: "5min",
      issuer: "caller-override-issuer",
      audience: "caller-override-audience",
      algorithm: "HS512",
      header: { alg: "HS512" },
    });
    const decoded = jwt.decode(token, { complete: true });
    assert.equal(decoded?.header.alg, "HS256");
    assert.equal(
      (decoded?.payload as JwtPayload).iss,
      JWT_CONFIGURATION.issuer
    );
    assert.equal(
      (decoded?.payload as JwtPayload).aud,
      JWT_CONFIGURATION.audiences[purpose]
    );
    assert.equal((service.verify(token, secret) as JwtPayload).id, 42);
    await new Promise<void>((resolve, reject) =>
      service.verify(token, secret, (error, payload) => {
        try {
          assert.ifError(error);
          assert.equal((payload as JwtPayload).id, 42);
          resolve();
        } catch (failure) {
          reject(failure);
        }
      })
    );
    const validClaims = {
      id: 42,
      iss: JWT_CONFIGURATION.issuer,
      aud: JWT_CONFIGURATION.audiences[purpose],
    };
    const rejected = [
      jwt.sign({ id: 42 }, secret, { expiresIn: "5min" }),
      jwt.sign({ id: 42, iss: validClaims.iss }, secret, { expiresIn: "5min" }),
      jwt.sign({ id: 42, aud: validClaims.aud }, secret, { expiresIn: "5min" }),
      jwt.sign({ ...validClaims, iss: "another-environment" }, secret, {
        expiresIn: "5min",
      }),
      jwt.sign({ ...validClaims, aud: "another-application" }, secret, {
        expiresIn: "5min",
      }),
      jwt.sign(validClaims, "another-secret", { expiresIn: "5min" }),
      jwt.sign(validClaims, secret, { algorithm: "HS512", expiresIn: "5min" }),
      jwt.sign(validClaims, secret, { expiresIn: -1 }),
      ...purposes
        .filter((other) => other !== purpose)
        .map((other) =>
          new JsonWebTokenService(other).sign({ id: 42 }, secret, {
            expiresIn: "5min",
          })
        ),
    ];
    for (const invalid of rejected) {
      assert.throws(() => service.verify(invalid, secret));
      await new Promise<void>((resolve, reject) =>
        service.verify(invalid, secret, (error, payload) => {
          try {
            assert.ok(error);
            assert.equal(payload, undefined);
            resolve();
          } catch (failure) {
            reject(failure);
          }
        })
      );
    }
    assert.throws(() =>
      service.sign({ ...validClaims, iss: "override" }, secret)
    );
  }
  assert.throws(() => new JsonWebTokenService("unknown" as JwtPurpose));
}

class MemorySessions implements IRefreshSessionRepository {
  readonly sessions = new Map<string, CreateRefreshSessionProps>();
  readonly revoked = new Set<string>();
  rotations = 0;
  async create(session: CreateRefreshSessionProps) {
    this.sessions.set(session.id, session);
  }
  async rotate(props: RotateRefreshSessionProps) {
    this.rotations++;
    const current = this.sessions.get(props.id);
    if (
      !current ||
      this.revoked.has(props.id) ||
      current.userId !== props.userId ||
      current.tokenHash !== props.currentTokenHash ||
      current.expiresAt <= new Date()
    )
      return false;
    this.sessions.set(props.id, {
      ...current,
      tokenHash: props.nextTokenHash,
      expiresAt: props.nextExpiresAt,
    });
    return true;
  }
  async revoke(id: string, userId: number) {
    if (this.sessions.get(id)?.userId === userId) this.revoked.add(id);
  }
}

async function verifyHttpAndSessions() {
  const sessions = new MemorySessions();
  const refresh = new RefreshSessionService(sessions);
  const password = "PolicyTest!123";
  const user = {
    id: 42,
    email: "jwt-policy@example.test",
    firstname: "Policy",
    lastname: "Test",
    password: await argon2.hash(password),
    role: "USER",
    verified: true,
    resetToken: null,
    resetTokenExpiration: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
  const repository = {
    async getUserByEmail() {
      return user;
    },
    async getUserById() {
      return user;
    },
    async isUserAccountVerified() {
      return true;
    },
  } as unknown as IUserRepository;
  const login = new Login(repository, refresh);
  const renew = new RenewSession(repository, refresh);
  const controller = new NativeSessionController(login, renew, refresh);
  const app = express();
  app.use(express.json());
  let privateCalls = 0;
  app.get("/private", tokenJwtTAuth, (req, res) => {
    privateCalls++;
    res.status(200).json({ id: req.user?.id });
  });
  app.post("/sessions", (req, res, next) =>
    Promise.resolve(controller.create(req, res)).catch(next)
  );
  app.post("/sessions/refresh", (req, res, next) =>
    Promise.resolve(controller.refresh(req, res)).catch(next)
  );
  app.post("/sessions/revoke", (req, res, next) =>
    Promise.resolve(controller.revoke(req, res)).catch(next)
  );
  app.use(errorHandler);

  const first = await supertest(app)
    .post("/sessions")
    .send({ email: user.email, password });
  assert.equal(first.status, 200);
  assert.equal(first.headers["set-cookie"], undefined);
  assert.equal(first.body.payload.accessTokenExpiresIn, 60);
  assert.equal(first.body.payload.refreshTokenExpiresIn, 900);
  const firstAccess = first.body.payload.accessToken;
  const firstRefresh = first.body.payload.refreshToken;
  assert.equal(
    (
      new JsonWebTokenService().verify(
        firstAccess,
        ACCESS_TOKEN_SECRET
      ) as JwtPayload
    ).id,
    42
  );
  assert.equal(refresh.verify(firstRefresh).id, 42);
  assert.ok(!JSON.stringify(first.body.payload.user).includes(user.password));
  const privateResponse = await supertest(app)
    .get("/private")
    .set("Authorization", `Bearer ${firstAccess}`);
  assert.deepEqual(privateResponse.body, { id: 42 });

  const invalidAccess = [
    jwt.sign({ id: 42 }, ACCESS_TOKEN_SECRET, { expiresIn: "1min" }),
    jwt.sign(
      {
        id: 42,
        iss: "private-wrong-issuer",
        aud: JWT_CONFIGURATION.audiences.access,
      },
      ACCESS_TOKEN_SECRET
    ),
    new JsonWebTokenService("refresh").sign({ id: 42 }, ACCESS_TOKEN_SECRET),
    firstRefresh,
  ];
  for (const token of invalidAccess) {
    const response = await supertest(app)
      .get("/private")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(response.status, 401);
    assert.equal(response.body.error.type, "Unauthorized");
    assert.ok(!JSON.stringify(response.body).includes("private-wrong-issuer"));
    assert.ok(!JSON.stringify(response.body).includes(ACCESS_TOKEN_SECRET));
  }
  assert.equal(privateCalls, 1);

  // A structurally valid old session with a matching stored hash still cannot
  // bypass mandatory issuer/audience checks or reach the repository rotation.
  const legacyId = "11111111-1111-4111-8111-111111111111";
  const legacy = jwt.sign(
    { id: 42, sessionId: legacyId },
    REFRESH_TOKEN_SECRET,
    {
      expiresIn: "15min",
      jwtid: "22222222-2222-4222-8222-222222222222",
    }
  );
  await sessions.create({
    id: legacyId,
    userId: 42,
    tokenHash: createHash("sha256").update(legacy).digest("hex"),
    expiresAt: new Date(Date.now() + 900000),
  });
  for (const token of [legacy, firstAccess]) {
    const response = await supertest(app)
      .post("/sessions/refresh")
      .send({ refreshToken: token });
    assert.equal(response.status, 401);
    assert.equal(response.body.error.type, "Unauthorized");
    assert.equal(response.body.payload, undefined);
  }
  assert.equal(sessions.rotations, 0);
  const rotated = await supertest(app)
    .post("/sessions/refresh")
    .send({ refreshToken: firstRefresh });
  assert.equal(rotated.status, 200);
  assert.equal(rotated.headers["set-cookie"], undefined);
  assert.equal(rotated.body.payload.accessTokenExpiresIn, 300);
  assert.equal(rotated.body.payload.refreshTokenExpiresIn, 900);
  assert.notEqual(rotated.body.payload.refreshToken, firstRefresh);
  assert.equal(
    (
      new JsonWebTokenService().verify(
        rotated.body.payload.accessToken,
        ACCESS_TOKEN_SECRET
      ) as JwtPayload
    ).id,
    42
  );
  assert.equal(refresh.verify(rotated.body.payload.refreshToken).id, 42);
  await supertest(app)
    .post("/sessions/refresh")
    .send({ refreshToken: firstRefresh })
    .expect(401);
  await supertest(app)
    .post("/sessions/refresh")
    .send({ refreshToken: rotated.body.payload.refreshToken })
    .expect(401);
  await supertest(app)
    .post("/sessions/revoke")
    .send({ refreshToken: legacy })
    .expect(204);
  const fresh = await login.execute({ email: user.email, password });
  assert.ok(fresh);
  await refresh.revoke(fresh.refreshToken);
  await assert.rejects(() => renew.execute(fresh.refreshToken), unauthorized);
}

async function verifyRegistration() {
  let message = "";
  let confirmations = 0;
  const repository = {
    async exists() {
      return false;
    },
    async isUserAccountVerified() {
      return false;
    },
    async create() {
      return { id: 42 };
    },
    async getUserById() {
      return { id: 42, email: "register@example.test" };
    },
    async confirmRegistration() {
      confirmations++;
      return true;
    },
    async sendMail(_: string, __: string, html: string) {
      message = html;
      return true;
    },
  } as unknown as IUserRepository;
  await new CreateUser(repository).execute({
    email: "register@example.test",
    firstname: "Test",
    lastname: "Policy",
    password: "PolicyTest!123",
    confirmpassword: "PolicyTest!123",
  });
  const match = message.match(/users\/verify\/42\/([^"\s<]+)/);
  assert.ok(match);
  const confirmation = new ConfirmRegistrationUser(repository);
  const claims = new JsonWebTokenService("registration").verify(
    match[1],
    REGISTER_TOKEN
  ) as JwtPayload;
  assert.equal(claims.email, "register@example.test");
  const invalid = [
    jwt.sign({ email: "register@example.test" }, REGISTER_TOKEN, {
      expiresIn: "5min",
    }),
    new JsonWebTokenService().sign(
      { email: "register@example.test" },
      REGISTER_TOKEN
    ),
    jwt.sign(
      {
        email: "register@example.test",
        iss: "other",
        aud: JWT_CONFIGURATION.audiences.registration,
      },
      REGISTER_TOKEN
    ),
  ];
  for (const token of invalid)
    await assert.rejects(() => confirmation.execute("42", token), unauthorized);
  assert.equal(confirmations, 0);
  await confirmation.execute("42", match[1]);
  assert.equal(confirmations, 1);
}

async function run() {
  await verifyPolicy();
  await verifyHttpAndSessions();
  await verifyRegistration();
  console.log("JWT issuer, audience and session transition tests passed");
}
run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
