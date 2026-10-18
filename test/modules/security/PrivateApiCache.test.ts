/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import supertest, { Response } from "supertest";
import { ACCESS_TOKEN_SECRET, APP_BASE_URL } from "../../../src/config/config";
import { createServer } from "../../../src/server";
import { JsonWebTokenService } from "../../../src/modules/auth/token/JsonWebTokenService";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Private API cache tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();
const tokenService = new JsonWebTokenService();
const baseUrl = APP_BASE_URL || "/v1";
const emailPrefix = "private-cache-";
const password = "Synthetic-Passw0rd!";

const assertPrivate = (response: Response, label: string, status: number) => {
  assert.strictEqual(response.status, status, `${label}: status`);
  assert.strictEqual(
    response.headers["cache-control"],
    "private, no-store",
    `${label}: Cache-Control`
  );
  assert.strictEqual(response.headers.etag, undefined, `${label}: ETag`);
};

const cookieValue = (response: Response, name: string): string => {
  const cookies = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
  // La connexion efface d'abord l'ancien cookie : garder la dernière valeur.
  const cookie = cookies.filter((value) => value.startsWith(`${name}=`)).pop();
  assert.ok(cookie, `Missing ${name} cookie`);
  return cookie.split(";")[0];
};

const cleanUsers = () =>
  prisma.utilisateur.deleteMany({ where: { email: { startsWith: emailPrefix } } });

const createUser = async (suffix: string, passwordHash: string) =>
  prisma.utilisateur.create({
    data: {
      email: `${emailPrefix}${suffix}@example.com`,
      password: passwordHash,
      firstname: "Private",
      lastname: "Cache",
      verified: true,
    },
  });

async function run() {
  await cleanUsers();
  const owner = await createUser("owner", await argon2.hash(password));
  // Hash volontairement invalide : argon2 lève une erreur et produit un 500.
  const broken = await createUser("broken", "not-an-argon2-hash");
  const ownerAuth = {
    Authorization: `Bearer ${tokenService.sign({ id: owner.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: "5m",
    })}`,
  };
  const app = await createServer({
    checkDatabase: async () => undefined,
    checkRateLimitStore: async () => undefined,
    apiDocsEnabled: true,
  });
  const api = () => supertest(app);

  // Sessions Web : connexion, renouvellement, déconnexion.
  const webLogin = await api()
    .post(`${baseUrl}/users/authenticate`)
    .send({ email: owner.email, password });
  assertPrivate(webLogin, "web login", 200);
  const webRefresh = await api()
    .post(`${baseUrl}/token`)
    .set("Cookie", cookieValue(webLogin, "refresh_token"))
    .send({ grant_type: "refresh_token", email: owner.email });
  assertPrivate(webRefresh, "web refresh", 200);
  assertPrivate(
    await api().post(`${baseUrl}/token`).send({ grant_type: "refresh_token", email: owner.email }),
    "web refresh without cookie",
    401
  );
  assertPrivate(
    await api()
      .post(`${baseUrl}/users/authenticate`)
      .send({ email: owner.email, password: "Wrong-Passw0rd!" }),
    "web login refused",
    401
  );
  assertPrivate(
    await api()
      .post(`${baseUrl}/users/authenticate`)
      .send({ email: broken.email, password }),
    "web login server error",
    500
  );

  // Sessions natives : connexion, renouvellement, révocation.
  const nativeLogin = await api()
    .post(`${baseUrl}/auth/native/sessions`)
    .send({ email: owner.email, password });
  assertPrivate(nativeLogin, "native login", 200);
  const nativeRefresh = await api()
    .post(`${baseUrl}/auth/native/sessions/refresh`)
    .send({ refreshToken: nativeLogin.body.payload.refreshToken });
  assertPrivate(nativeRefresh, "native refresh", 200);
  assertPrivate(
    await api()
      .post(`${baseUrl}/auth/native/sessions/refresh`)
      .send({ refreshToken: "synthetic-invalid-token" }),
    "native refresh refused",
    401
  );
  assertPrivate(
    await api()
      .post(`${baseUrl}/auth/native/sessions/revoke`)
      .send({ refreshToken: nativeRefresh.body.payload.refreshToken }),
    "native revoke",
    204
  );

  // Données financières et leurs refus.
  assertPrivate(
    await api().get(`${baseUrl}/operation-categories`).set(ownerAuth),
    "categories list",
    200
  );
  const category = await api()
    .post(`${baseUrl}/operation-categories`)
    .set(ownerAuth)
    .send({ name: "Cache" });
  assertPrivate(category, "category create", 201);
  assertPrivate(
    await api()
      .post(`${baseUrl}/operation-categories`)
      .set(ownerAuth)
      .send({ name: "Cache" }),
    "category conflict",
    409
  );
  assertPrivate(
    await api()
      .post(`${baseUrl}/operation-categories`)
      .set(ownerAuth)
      .send({ name: "" }),
    "category invalid",
    422
  );
  assertPrivate(
    await api()
      .delete(`${baseUrl}/operation-categories/${category.body.data.id}`)
      .set(ownerAuth),
    "category delete",
    204
  );
  assertPrivate(
    await api().get(`${baseUrl}/operations/999999999`).set(ownerAuth),
    "operation not found",
    404
  );
  assertPrivate(await api().get(`${baseUrl}/operations`), "missing token", 401);
  assertPrivate(
    await api().get(`${baseUrl}/operations`).set("Authorization", "Bearer invalid"),
    "invalid token",
    401
  );
  assertPrivate(await api().get(`${baseUrl}/users`).set(ownerAuth), "admin only", 403);

  // Validation conditionnelle : jamais de 304 ni d'ETag sur une réponse privée.
  for (const ifNoneMatch of ["*", 'W/"synthetic"']) {
    assertPrivate(
      await api()
        .get(`${baseUrl}/operation-categories`)
        .set(ownerAuth)
        .set("If-None-Match", ifNoneMatch),
      `conditional ${ifNoneMatch}`,
      200
    );
  }
  assertPrivate(
    await api()
      .get(`${baseUrl}/operation-categories`)
      .set(ownerAuth)
      .set("If-Modified-Since", new Date().toUTCString()),
    "conditional If-Modified-Since",
    200
  );

  // Erreurs produites avant le routeur.
  assertPrivate(
    await api()
      .post(`${baseUrl}/users/authenticate`)
      .set("Content-Type", "application/json")
      .send('{"email":'),
    "malformed JSON",
    400
  );
  assertPrivate(
    await api()
      .post(`${baseUrl}/users/authenticate`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ value: "x".repeat(65 * 1024) })),
    "oversized JSON",
    413
  );
  assertPrivate(
    await api().get(`${baseUrl}/operations`).set("Origin", "https://denied.example.test"),
    "denied origin",
    403
  );
  assertPrivate(await api().get(`${baseUrl}/unknown-route`), "unknown API route", 404);
  assertPrivate(await api().get(`${baseUrl}/`), "API root", 200);
  let limited: Response | undefined;
  // `refreshRateLimiter` accepte 30 requêtes par fenêtre : la 31e est refusée.
  for (let attempt = 0; attempt < 31; attempt += 1) {
    limited = await api().post(`${baseUrl}/token`).send({});
  }
  assertPrivate(limited as Response, "rate limited", 429);

  // Les sondes et la documentation publique gardent leur politique.
  const live = await api().get("/health/live");
  assert.strictEqual(live.headers["cache-control"], "no-store");
  const docs = await api().get("/api-docs/");
  assert.strictEqual(docs.status, 200);
  assert.notStrictEqual(docs.headers["cache-control"], "private, no-store");
}

run()
  .then(() => console.log("Private API cache tests passed"))
  .finally(async () => {
    await cleanUsers();
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
