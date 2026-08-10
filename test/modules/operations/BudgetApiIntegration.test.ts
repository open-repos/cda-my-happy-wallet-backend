/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { PrismaClient } from "@prisma/client";
import supertest from "supertest";
import { ACCESS_TOKEN_SECRET, APP_BASE_URL } from "../../../src/config/config";
import { createServer } from "../../../src/server";
import { JsonWebTokenService } from "../../../src/modules/auth/token/JsonWebTokenService";
import { UserRepo } from "../../../src/modules/user/userRepo";
import swagger from "../../../src/utils/swagger.def";
import { FakeMailer } from "../../fakes/FakeMailer";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Budget API integration tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();
const tokenService = new JsonWebTokenService();
const baseUrl = APP_BASE_URL || "/v1";

const createUser = async (email: string) =>
  new UserRepo(prisma, new FakeMailer()).create({
    email,
    password: "hashed-password",
    firstname: "Budget",
    lastname: "Integration",
    confirmpassword: "hashed-password",
  });

const accessToken = (userId: number): string =>
  tokenService.sign({ id: userId }, ACCESS_TOKEN_SECRET, { expiresIn: "5m" });

const authorization = (token: string): { Authorization: string } => ({
  Authorization: `Bearer ${token}`,
});

async function cleanDatabase() {
  await prisma.oneOffOperationRecord.deleteMany();
  await prisma.operationCategory.deleteMany();
  await prisma.utilisateur.deleteMany();
}

function assertOpenApiContract() {
  const document = swagger as unknown as {
    paths: Record<string, Record<string, unknown>>;
    components: { schemas: Record<string, Record<string, unknown>> };
  };
  const expectedMethods: Record<string, string[]> = {
    "/operation-categories": ["get", "post"],
    "/operation-categories/{id}": ["put", "delete"],
    "/operations": ["get", "post"],
    "/operations/{id}": ["get", "put", "delete"],
  };

  for (const [path, methods] of Object.entries(expectedMethods)) {
    assert.ok(document.paths[path], `Missing OpenAPI path ${path}`);
    for (const method of methods) {
      const operation = document.paths[path][method] as {
        security?: unknown[];
        responses?: Record<string, unknown>;
      };
      assert.ok(operation, `Missing OpenAPI operation ${method} ${path}`);
      assert.deepStrictEqual(operation.security, [{ accessToken_auth: [] }]);
      assert.ok(operation.responses?.["401"]);
      assert.ok(operation.responses?.["422"]);
    }
  }

  assert.strictEqual(
    document.components.schemas.OneOffOperationInput.additionalProperties,
    false
  );
  assert.strictEqual(
    document.components.schemas.OperationCategoryInput.additionalProperties,
    false
  );
}

async function run() {
  await cleanDatabase();
  assertOpenApiContract();

  const owner = await createUser("budget-api-owner@example.test");
  const other = await createUser("budget-api-other@example.test");
  const ownerAuth = authorization(accessToken(owner.id));
  const otherAuth = authorization(accessToken(other.id));
  const app = await createServer({
    checkDatabase: async () => undefined,
    apiDocsEnabled: false,
  });

  const missingToken = await supertest(app).get(`${baseUrl}/operations`);
  assert.strictEqual(missingToken.status, 401);

  const invalidToken = await supertest(app)
    .get(`${baseUrl}/operations`)
    .set("Authorization", "Bearer invalid");
  assert.strictEqual(invalidToken.status, 401);

  const defaults = await supertest(app)
    .get(`${baseUrl}/operation-categories`)
    .set(ownerAuth);
  assert.strictEqual(defaults.status, 200);
  assert.strictEqual(defaults.body.data.length, 4);
  assert.ok(
    defaults.body.data.every(
      (category: Record<string, unknown>) =>
        !("ownerId" in category) && !("templateId" in category)
    )
  );

  const forbiddenOwnershipInput = await supertest(app)
    .post(`${baseUrl}/operation-categories`)
    .set(ownerAuth)
    .send({ name: "Voyage", ownerId: other.id });
  assert.strictEqual(forbiddenOwnershipInput.status, 422);

  const category = await supertest(app)
    .post(`${baseUrl}/operation-categories`)
    .set(ownerAuth)
    .send({ name: "Voyage", color: "#336699" });
  assert.strictEqual(category.status, 201);
  const categoryId = category.body.data.id as number;

  const duplicateCategory = await supertest(app)
    .post(`${baseUrl}/operation-categories`)
    .set(ownerAuth)
    .send({ name: "Voyage" });
  assert.strictEqual(duplicateCategory.status, 409);

  const operation = await supertest(app)
    .post(`${baseUrl}/operations`)
    .set(ownerAuth)
    .send({
      title: "Billet de train",
      amount: "78.40",
      currency: "eur",
      kind: "DEPENSE",
      operationDate: "2026-08-10",
      categoryId,
    });
  assert.strictEqual(operation.status, 201);
  assert.match(operation.headers.location, /\/operations\/\d+$/);
  assert.deepStrictEqual(operation.body.data, {
    id: operation.body.data.id,
    title: "Billet de train",
    amount: "78.40",
    currency: "EUR",
    type: "DEPENSE",
    operationDate: "2026-08-10",
    categoryId,
  });
  const operationId = operation.body.data.id as number;

  const persisted = await prisma.oneOffOperationRecord.findUniqueOrThrow({
    where: { id: operationId },
  });
  assert.strictEqual(persisted.userId, owner.id);
  assert.strictEqual(persisted.amount.toFixed(2), "78.40");

  const hiddenOperation = await supertest(app)
    .get(`${baseUrl}/operations/${operationId}`)
    .set(otherAuth);
  assert.strictEqual(hiddenOperation.status, 404);

  const foreignCategory = await prisma.operationCategory.findFirstOrThrow({
    where: { userId: other.id },
  });
  const foreignCategoryInput = await supertest(app)
    .put(`${baseUrl}/operations/${operationId}`)
    .set(ownerAuth)
    .send({
      title: "Tentative étrangère",
      amount: "1.00",
      currency: "EUR",
      kind: "DEPENSE",
      operationDate: "2026-08-10",
      categoryId: foreignCategory.id,
    });
  assert.strictEqual(foreignCategoryInput.status, 404);

  const categoryInUse = await supertest(app)
    .delete(`${baseUrl}/operation-categories/${categoryId}`)
    .set(ownerAuth);
  assert.strictEqual(categoryInUse.status, 409);

  const updated = await supertest(app)
    .put(`${baseUrl}/operations/${operationId}`)
    .set(ownerAuth)
    .send({
      title: "Billet remboursé",
      amount: "78.40",
      currency: "EUR",
      kind: "ENTREE",
      operationDate: "2026-08-12",
      categoryId,
    });
  assert.strictEqual(updated.status, 200);
  assert.strictEqual(updated.body.data.type, "ENTREE");

  const list = await supertest(app)
    .get(`${baseUrl}/operations`)
    .set(ownerAuth);
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body.data.length, 1);
  assert.ok(!("ownerId" in list.body.data[0]));
  assert.ok(!("legacyOperationId" in list.body.data[0]));

  assert.strictEqual(
    (
      await supertest(app)
        .delete(`${baseUrl}/operations/${operationId}`)
        .set(ownerAuth)
    ).status,
    204
  );
  assert.strictEqual(
    (
      await supertest(app)
        .delete(`${baseUrl}/operation-categories/${categoryId}`)
        .set(ownerAuth)
    ).status,
    204
  );

  const deletedOperation = await supertest(app)
    .get(`${baseUrl}/operations/${operationId}`)
    .set(ownerAuth);
  assert.strictEqual(deletedOperation.status, 404);
}

run()
  .then(() => console.log("Budget API integration tests passed"))
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
