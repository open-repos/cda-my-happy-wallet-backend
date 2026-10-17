/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { PrismaClient } from "@prisma/client";
import supertest from "supertest";
import { ACCESS_TOKEN_SECRET, APP_BASE_URL } from "../../../src/config/config";
import { createServer } from "../../../src/server";
import { JsonWebTokenService } from "../../../src/modules/auth/token/JsonWebTokenService";
import { UserRepo } from "../../../src/modules/user/userRepo";
import { FakeMailer } from "../../fakes/FakeMailer";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Collection pagination tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();
const tokenService = new JsonWebTokenService();
const baseUrl = APP_BASE_URL || "/v1";

const accessToken = (userId: number): string =>
  tokenService.sign({ id: userId }, ACCESS_TOKEN_SECRET, { expiresIn: "5m" });

const authorization = (userId: number): { Authorization: string } => ({
  Authorization: `Bearer ${accessToken(userId)}`,
});

const createUser = async (email: string) =>
  new UserRepo(prisma, new FakeMailer()).create({
    email,
    password: "hashed-password",
    firstname: "Pagination",
    lastname: "Integration",
    confirmpassword: "hashed-password",
  });

async function cleanDatabase() {
  await prisma.oneOffOperationRecord.deleteMany();
  await prisma.operationCategory.deleteMany();
  await prisma.resteAVivre.deleteMany();
  await prisma.operationFixe.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.utilisateur.deleteMany();
}

const tamper = (cursor: string): string => {
  const index = Math.max(
    cursor.indexOf(".") + 2,
    Math.floor(cursor.length / 2)
  );
  const replacement = cursor[index] === "A" ? "B" : "A";
  return `${cursor.slice(0, index)}${replacement}${cursor.slice(index + 1)}`;
};

async function run() {
  await cleanDatabase();
  const owner = await createUser("pagination-owner@example.test");
  const other = await createUser("pagination-other@example.test");
  const admin = await createUser("pagination-admin@example.test");
  await prisma.utilisateur.update({
    where: { id: admin.id },
    data: { role: "ADMIN" },
  });

  const category = await prisma.operationCategory.findFirstOrThrow({
    where: { userId: owner.id },
    orderBy: { id: "asc" },
  });
  for (let index = 1; index <= 5; index += 1) {
    await prisma.oneOffOperationRecord.create({
      data: {
        title: `Operation ${index}`,
        amount: `${index}.00`,
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date(`2026-08-${10 + index}T00:00:00.000Z`),
        userId: owner.id,
        categoryId: category.id,
      },
    });
  }
  await prisma.operationFixe.createMany({
    data: [
      {
        titre: "Loyer",
        montant: "800.00",
        devise: "EUR",
        typeOperation: "CHARGE",
        userId: owner.id,
      },
      {
        titre: "Internet",
        montant: "40.00",
        devise: "EUR",
        typeOperation: "CHARGE",
        userId: owner.id,
      },
      {
        titre: "Assurance",
        montant: "60.00",
        devise: "EUR",
        typeOperation: "CHARGE",
        userId: owner.id,
      },
      {
        titre: "Salaire",
        montant: "2200.00",
        devise: "EUR",
        typeOperation: "REVENU",
        userId: owner.id,
      },
      {
        titre: "Prime",
        montant: "300.00",
        devise: "EUR",
        typeOperation: "REVENU",
        userId: owner.id,
      },
    ],
  });

  const originalOperations = await prisma.oneOffOperationRecord.findMany({
    where: { userId: owner.id },
    orderBy: [{ operationDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  const originalIds = originalOperations.map(({ id }) => id);
  const app = await createServer({
    checkDatabase: async () => undefined,
    apiDocsEnabled: false,
  });
  const ownerAuth = authorization(owner.id);

  const first = await supertest(app)
    .get(`${baseUrl}/operations?limit=2`)
    .set(ownerAuth);
  assert.strictEqual(first.status, 200);
  assert.deepStrictEqual(
    first.body.data.map(({ id }: { id: number }) => id),
    originalIds.slice(0, 2)
  );
  assert.deepStrictEqual(
    { limit: first.body.meta.limit, hasNext: first.body.meta.hasNext },
    { limit: 2, hasNext: true }
  );
  assert.strictEqual(typeof first.body.meta.nextCursor, "string");

  await prisma.oneOffOperationRecord.create({
    data: {
      title: "Insertion concurrente",
      amount: "9.00",
      currency: "EUR",
      type: "DEPENSE",
      operationDate: new Date("2026-08-31T00:00:00.000Z"),
      userId: owner.id,
      categoryId: category.id,
    },
  });

  const second = await supertest(app)
    .get(`${baseUrl}/operations?limit=2&cursor=${first.body.meta.nextCursor}`)
    .set(ownerAuth);
  assert.strictEqual(second.status, 200);
  assert.deepStrictEqual(
    second.body.data.map(({ id }: { id: number }) => id),
    originalIds.slice(2, 4)
  );
  const third = await supertest(app)
    .get(`${baseUrl}/operations?limit=2&cursor=${second.body.meta.nextCursor}`)
    .set(ownerAuth);
  assert.strictEqual(third.status, 200);
  assert.deepStrictEqual(
    third.body.data.map(({ id }: { id: number }) => id),
    originalIds.slice(4)
  );
  assert.deepStrictEqual(third.body.meta, {
    limit: 2,
    hasNext: false,
    nextCursor: null,
  });

  const tampered = await supertest(app)
    .get(`${baseUrl}/operations?cursor=${tamper(first.body.meta.nextCursor)}`)
    .set(ownerAuth);
  assert.strictEqual(tampered.status, 422);
  assert.strictEqual(
    tampered.body.error.message,
    "Pagination parameters are invalid"
  );

  const crossOwner = await supertest(app)
    .get(`${baseUrl}/operations?cursor=${first.body.meta.nextCursor}`)
    .set(authorization(other.id));
  assert.strictEqual(crossOwner.status, 422);

  const crossResource = await supertest(app)
    .get(`${baseUrl}/operation-categories?cursor=${first.body.meta.nextCursor}`)
    .set(ownerAuth);
  assert.strictEqual(crossResource.status, 422);

  for (const query of ["limit=0", "limit=101", "limit=1.5", "offset=1"]) {
    const invalid = await supertest(app)
      .get(`${baseUrl}/operations?${query}`)
      .set(ownerAuth);
    assert.strictEqual(invalid.status, 422, query);
  }

  const empty = await supertest(app)
    .get(`${baseUrl}/operations`)
    .set(authorization(other.id));
  assert.deepStrictEqual(empty.body, {
    data: [],
    meta: { limit: 50, hasNext: false, nextCursor: null },
  });

  const categories = await supertest(app)
    .get(`${baseUrl}/operation-categories?limit=2`)
    .set(ownerAuth);
  assert.strictEqual(categories.status, 200);
  assert.strictEqual(categories.body.data.length, 2);
  assert.strictEqual(categories.body.meta.hasNext, true);
  assert.ok(
    categories.body.data.every(
      (row: Record<string, unknown>) => !("ownerId" in row)
    )
  );

  const fixed = await supertest(app)
    .get(`${baseUrl}/operations-fixes?limit=2`)
    .set(ownerAuth);
  assert.strictEqual(fixed.status, 200);
  assert.strictEqual(fixed.body.data.length, 2);
  assert.strictEqual(fixed.body.meta.hasNext, true);
  const fixedSecond = await supertest(app)
    .get(
      `${baseUrl}/operations-fixes?limit=2&cursor=${fixed.body.meta.nextCursor}`
    )
    .set(ownerAuth);
  assert.strictEqual(fixedSecond.status, 200);
  assert.strictEqual(fixedSecond.body.data.length, 2);

  const charges = await supertest(app)
    .get(`${baseUrl}/operations-fixes/charges?limit=2`)
    .set(ownerAuth);
  assert.strictEqual(charges.status, 200);
  assert.strictEqual(charges.body.data.length, 2);
  const wrongFixedResource = await supertest(app)
    .get(
      `${baseUrl}/operations-fixes/revenus?cursor=${charges.body.meta.nextCursor}`
    )
    .set(ownerAuth);
  assert.strictEqual(wrongFixedResource.status, 422);

  const adminUsers = await supertest(app)
    .get(`${baseUrl}/users?limit=2`)
    .set(authorization(admin.id));
  assert.strictEqual(adminUsers.status, 200);
  assert.strictEqual(adminUsers.body.data.length, 2);
  assert.strictEqual(adminUsers.body.meta.hasNext, true);
  assert.ok(
    adminUsers.body.data.every(
      (row: Record<string, unknown>) =>
        !("password" in row) && !("resetToken" in row)
    )
  );
  const adminSecond = await supertest(app)
    .get(`${baseUrl}/users?limit=2&cursor=${adminUsers.body.meta.nextCursor}`)
    .set(authorization(admin.id));
  assert.strictEqual(adminSecond.status, 200);
  assert.strictEqual(adminSecond.body.meta.hasNext, false);

  const forbiddenAdminList = await supertest(app)
    .get(`${baseUrl}/users`)
    .set(ownerAuth);
  assert.strictEqual(forbiddenAdminList.status, 403);

  // Les règles et leurs occurrences n'ont pas le même ordre : les ancrages
  // 30/31 convergent en février, où l'identifiant départage les occurrences.
  const eventIds: number[] = [];
  const goalIds: number[] = [];
  for (const day of [31, 31, 30]) {
    const event = await prisma.evenementMensuel.create({
      data: {
        title: `Événement ${eventIds.length + 1}`,
        amount: "12.30",
        currency: "EUR",
        kind: "DEPENSE",
        startDate: new Date(`2026-01-${day}T00:00:00.000Z`),
        recurrence: "MENSUELLE",
        userId: owner.id,
      },
    });
    eventIds.push(event.id);
    const goal = await prisma.objectifFinancier.create({
      data: {
        title: `Objectif ${goalIds.length + 1}`,
        targetAmount: "100.00",
        savedAmount: "12.30",
        monthlyContribution: "10.00",
        currency: "EUR",
        userId: owner.id,
      },
    });
    goalIds.push(goal.id);
  }
  const privateEvent = await prisma.evenementMensuel.create({
    data: {
      title: "Événement privé",
      amount: "1.00",
      currency: "EUR",
      kind: "ENTREE",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      recurrence: "MENSUELLE",
      userId: other.id,
    },
  });
  const privateGoal = await prisma.objectifFinancier.create({
    data: {
      title: "Objectif privé",
      targetAmount: "1.00",
      currency: "EUR",
      userId: other.id,
    },
  });
  const eventKeys = [
    "id",
    "title",
    "amount",
    "currency",
    "kind",
    "startDate",
    "recurrence",
    "endDate",
  ];
  for (const resource of [
    {
      path: "/events",
      ids: [eventIds[2], eventIds[0], eventIds[1]],
      privateId: privateEvent.id,
      keys: eventKeys,
    },
    {
      path: "/event-occurrences?month=2026-02",
      ids: eventIds,
      privateId: privateEvent.id,
      keys: [...eventKeys, "occurrenceDate"],
    },
    {
      path: "/goals",
      ids: goalIds,
      privateId: privateGoal.id,
      keys: [
        "id",
        "title",
        "targetAmount",
        "savedAmount",
        "monthlyContribution",
        "currency",
        "targetDate",
        "forecast",
      ],
    },
  ]) {
    const separator = resource.path.includes("?") ? "&" : "?";
    const url = `${baseUrl}${resource.path}`;
    const path = `${baseUrl}${resource.path.split("?")[0]}`;
    assert.strictEqual((await supertest(app).get(url)).status, 401);
    assert.strictEqual(
      (await supertest(app).get(url).set("Authorization", "Bearer invalid"))
        .status,
      401
    );

    const pageOne = await supertest(app)
      .get(`${url}${separator}limit=2`)
      .set(ownerAuth);
    assert.strictEqual(pageOne.status, 200, resource.path);
    assert.match(pageOne.headers["content-type"], /^application\/json\b/);
    assert.strictEqual(pageOne.body.meta.limit, 2);
    assert.strictEqual(pageOne.body.meta.hasNext, true);
    assert.strictEqual(typeof pageOne.body.meta.nextCursor, "string");
    const cursor = pageOne.body.meta.nextCursor as string;
    const pageTwo = await supertest(app)
      .get(`${url}${separator}limit=2&cursor=${encodeURIComponent(cursor)}`)
      .set(ownerAuth);
    assert.strictEqual(pageTwo.status, 200);
    assert.deepStrictEqual(pageTwo.body.meta, {
      limit: 2,
      hasNext: false,
      nextCursor: null,
    });
    assert.deepStrictEqual(
      [...pageOne.body.data, ...pageTwo.body.data].map(
        (row: { id: number }) => row.id
      ),
      resource.ids,
      resource.path
    );
    const privatePage = await supertest(app)
      .get(url)
      .set(authorization(other.id));
    assert.strictEqual(privatePage.status, 200);
    assert.deepStrictEqual(
      privatePage.body.data.map((row: { id: number }) => row.id),
      [resource.privateId]
    );
    assert.deepStrictEqual(privatePage.body.meta, {
      limit: 50,
      hasNext: false,
      nextCursor: null,
    });
    const emptyPage = await supertest(app)
      .get(url)
      .set(authorization(admin.id));
    assert.deepStrictEqual(emptyPage.body, {
      data: [],
      meta: { limit: 50, hasNext: false, nextCursor: null },
    });
    for (const response of [pageOne, pageTwo, privatePage]) {
      assert.deepStrictEqual(Object.keys(response.body).sort(), [
        "data",
        "meta",
      ]);
      for (const row of response.body.data) {
        assert.deepStrictEqual(
          Object.keys(row).sort(),
          [...resource.keys].sort()
        );
      }
    }

    // Ces vérifications traversent les vrais routeurs, JWT et dépôts SQL.
    // Les faux dépôts des suites API ne simulent pas le décodage des curseurs.
    for (const query of [
      "limit=0",
      "limit=101",
      "limit=1.5",
      "limit=2&limit=3",
      "offset=1",
      "ownerId=999",
      "cursor=",
    ]) {
      const invalid = await supertest(app)
        .get(`${url}${separator}${query}`)
        .set(ownerAuth);
      assert.strictEqual(invalid.status, 422, `${resource.path} / ${query}`);
      assert.strictEqual(invalid.body.error.type, "ValidationFailed");
      assert.strictEqual(invalid.body.error.statusCode, 422);
      assert.strictEqual(invalid.body.error.path, path);
    }
    const invalidCursorRequests = [
      supertest(app).get(`${url}${separator}cursor=invalid`).set(ownerAuth),
      supertest(app)
        .get(`${url}${separator}cursor=${encodeURIComponent(tamper(cursor))}`)
        .set(ownerAuth),
      supertest(app)
        .get(`${url}${separator}cursor=${encodeURIComponent(cursor)}`)
        .set(authorization(other.id)),
    ];
    for (const request of invalidCursorRequests) {
      const invalid = await request;
      assert.strictEqual(invalid.status, 422);
      assert.deepStrictEqual(invalid.body, {
        response: "error",
        error: {
          type: "ValidationFailed",
          path,
          statusCode: 422,
          message: "Pagination parameters are invalid",
        },
      });
    }
    const target = resource.path === "/events" ? "/goals" : "/events";
    const crossResourceResponse = await supertest(app)
      .get(`${baseUrl}${target}?cursor=${encodeURIComponent(cursor)}`)
      .set(ownerAuth);
    assert.strictEqual(crossResourceResponse.status, 422);
    if (resource.path.includes("month=")) {
      const changedMonth = await supertest(app)
        .get(
          `${baseUrl}/event-occurrences?month=2026-03&cursor=${encodeURIComponent(
            cursor
          )}`
        )
        .set(ownerAuth);
      assert.strictEqual(changedMonth.status, 422);
    }
  }
}

run()
  .then(() => console.log("Collection pagination integration tests passed"))
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
