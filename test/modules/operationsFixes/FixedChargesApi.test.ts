/// <reference path="../../../src/utils/custom.d.ts" />
import assert from "assert";
import supertest from "supertest";
import { Prisma } from "@prisma/client";
import { OperationFixeRepo } from "../../../src/modules/operationsFixes/operationFixeRepo";
import { ResteAVivreCalculator } from "../../../src/modules/operationsFixes/services/ResteAVivreCalculator";
import { CreateOperationFixe } from "../../../src/modules/operationsFixes/useCases/createOperationFixe/createOperationFixe";
import { UpdateOperationFixe } from "../../../src/modules/operationsFixes/useCases/updateOperationFixe/updateOperationFixe";
import { ReadOperationFixe } from "../../../src/modules/operationsFixes/useCases/readOperationFixe/readOperationFixe";
import { DeleteOperationFixe } from "../../../src/modules/operationsFixes/useCases/deleteOperationFixe/deleteOperationFixe";
import { ReadAllOperationFixe } from "../../../src/modules/operationsFixes/useCases/readAllOperationFixe/readAllOperationFixe";

process.env.ACCESS_TOKEN = "test-access-token-secret-at-least-32-characters";
process.env.DATABASE_URL =
  "mysql://test-user:test-password@127.0.0.1:3306/myhappywallet_test";

async function run() {
  const express = require("express") as typeof import("express");
  const { JsonWebTokenService } =
    require("../../../src/modules/auth/token/JsonWebTokenService") as typeof import("../../../src/modules/auth/token/JsonWebTokenService");
  // Only persistence is replaced. Requests cross real authentication,
  // validation, controllers, use cases and the fixed-operation repository.
  const rows: any[] = [];
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, value]) => {
      if (key === "idOperationFixe" && typeof value === "object")
        return row[key] < (value as { lt: number }).lt;
      return row[key] === value;
    });
  let legacyExpense = -1;
  const categories = [
    {
      id: 10,
      userId: 42,
      name: "Assurances",
      color: null,
      icon: "solid:shield-halved",
      fixedKind: "CHARGE",
    },
    {
      id: 11,
      userId: 42,
      name: "Salaires",
      color: null,
      icon: "solid:money-bill-wave",
      fixedKind: "REVENU",
    },
    {
      id: 12,
      userId: 43,
      name: "Privé",
      color: null,
      icon: null,
      fixedKind: null,
    },
    {
      id: 13,
      userId: 42,
      name: "Personnel",
      color: null,
      icon: null,
      fixedKind: null,
    },
  ];
  const hydrate = (row: any) => ({
    ...row,
    category: categories.find((c) => c.id === row.categoryId) ?? null,
  });
  const entities = {
    operationCategory: {
      findFirst: async ({ where }: any) => {
        return (
          categories.find(
            (c) => c.id === where.id && c.userId === where.userId
          ) ?? null
        );
      },
    },
    operationFixe: {
      create: async ({ data }: any) => {
        const row = {
          idOperationFixe: rows.length + 1,
          periodicite: "MENSUELLE",
          pourcentagePersonnel: 100,
          ...data,
        };
        rows.push(row);
        return hydrate(row);
      },
      findMany: async ({ where, take }: any) =>
        rows
          .filter((row) => matches(row, where))
          .sort((a, b) => b.idOperationFixe - a.idOperationFixe)
          .slice(0, take)
          .map(hydrate),
      updateMany: async ({ where, data }: any) => {
        const found = rows.filter((row) => matches(row, where));
        found.forEach((row) => Object.assign(row, data));
        return { count: found.length };
      },
      deleteMany: async ({ where }: any) => {
        const found = rows.filter((row) => matches(row, where));
        found.forEach((row) => rows.splice(rows.indexOf(row), 1));
        return { count: found.length };
      },
    },
    resteAVivre: {
      findMany: async () => [],
      create: async ({ data }: any) => {
        legacyExpense = data.montantTotalDepense;
        return { idRaV: 1 };
      },
    },
    $queryRaw: async (query: Prisma.Sql) => {
      assert.match(query.sql, /WHERE userId = \?/);
      assert.match(query.sql, /SUM\(/);
      assert.match(query.sql, /ROUND\(/);
      const owned = rows.filter((row) => row.userId === query.values[0]);
      const result = ResteAVivreCalculator.calculate(
        owned.filter((r) => r.typeOperation === "REVENU"),
        owned.filter((r) => r.typeOperation === "CHARGE")
      );
      return [
        {
          typeOperation: "REVENU",
          total: new Prisma.Decimal(result.montantTotalEntree),
        },
        {
          typeOperation: "CHARGE",
          total: new Prisma.Decimal(result.montantTotalDepense),
        },
      ];
    },
  };
  const repository = new OperationFixeRepo(entities);
  const bindings: [string, string, unknown][] = [
    [
      "createOperationFixe",
      "createOperationFixeController",
      new CreateOperationFixe(repository),
    ],
    [
      "updateOperationFixe",
      "updateOperationFixeController",
      new UpdateOperationFixe(repository),
    ],
    [
      "readOperationFixe",
      "readOperationFixeController",
      new ReadOperationFixe(repository),
    ],
    [
      "deleteOperationFixe",
      "deleteOperationFixeController",
      new DeleteOperationFixe(repository),
    ],
    [
      "readAllOperationFixe",
      "readAllOperationFixeController",
      new ReadAllOperationFixe(repository),
    ],
  ];
  for (const [moduleName, controller, useCase] of bindings) {
    require(`../../../src/modules/operationsFixes/useCases/${moduleName}`)[
      controller
    ].useCase = useCase;
  }
  const {
    operationFixeRouter,
  } = require("../../../src/routes/operationsFixes");
  const {
    errorHandler,
  } = require("../../../src/middlewares/errorHandler.middleware");
  const document = require("../../../src/utils/swagger.def").default;
  assert.deepStrictEqual(
    document.components.schemas.Charge.properties.periodicite.enum,
    ["MENSUELLE", "BIMESTRIELLE", "TRIMESTRIELLE", "SEMESTRIELLE", "ANNUELLE"]
  );
  assert.ok(
    !("pourcentagePersonnel" in document.components.schemas.Revenu.properties)
  );
  assert.ok(!("userId" in document.components.schemas.FixedCharge.properties));
  assert.strictEqual(
    document.paths["/operations-fixes/charges"].get.responses[200].content[
      "application/json"
    ].schema.properties.data.items.$ref,
    "#/components/schemas/FixedCharge"
  );
  const app = express();
  app.use(express.json());
  app.use("/operations-fixes", operationFixeRouter);
  app.use(errorHandler);
  const token = (id: number) =>
    new JsonWebTokenService().sign({ id }, process.env.ACCESS_TOKEN as string);
  const owner = `Bearer ${token(42)}`;
  const other = `Bearer ${token(43)}`;
  const input = {
    titre: "Abonnement",
    montant: 120,
    devise: "EUR",
    periodicite: "ANNUELLE",
    pourcentagePersonnel: 50,
  };
  const created = await supertest(app)
    .post("/operations-fixes/charges")
    .set("Authorization", owner)
    .send({ ...input, userId: 43 });
  assert.strictEqual(created.status, 201);
  assert.deepStrictEqual(created.body.data, {
    ...input,
    idOperationFixe: 1,
    categoryId: null,
    category: null,
    montantPersonnel: "60.00",
    montantMensuelPersonnel: "5.00",
  });
  assert.strictEqual(rows[0].userId, 42);
  assert.strictEqual(legacyExpense, 5);
  const read = await supertest(app)
    .get("/operations-fixes/charges/1")
    .set("Authorization", owner);
  assert.strictEqual(read.status, 200);
  assert.strictEqual(read.body.data[0].montantMensuelPersonnel, "5.00");
  for (const [field, value] of [
    ["pourcentagePersonnel", 100.01],
    ["pourcentagePersonnel", 50.001],
    ["periodicite", "INVALID"],
    ["montant", 0.001],
  ]) {
    const response = await supertest(app)
      .post("/operations-fixes/charges")
      .set("Authorization", owner)
      .send({ ...input, [field]: value });
    assert.strictEqual(response.status, 400);
  }
  const updated = await supertest(app)
    .put("/operations-fixes/charges/1")
    .set("Authorization", owner)
    .send({ titre: "Abonnement modifié", montant: 240, devise: "EUR" });
  assert.strictEqual(updated.status, 200);
  assert.strictEqual(rows[0].periodicite, "ANNUELLE");
  assert.strictEqual(rows[0].pourcentagePersonnel, 50);
  assert.strictEqual(legacyExpense, 10);
  const listed = await supertest(app)
    .get("/operations-fixes/charges")
    .set("Authorization", owner);
  assert.strictEqual(listed.body.data[0].montantMensuelPersonnel, "10.00");
  assert.ok(!("userId" in listed.body.data[0]));
  const hidden = await supertest(app)
    .get("/operations-fixes/charges")
    .set("Authorization", other);
  assert.deepStrictEqual(hidden.body.data, []);
  for (const actor of [other, owner]) {
    const path = actor === other ? "charges" : "revenus";
    const get = await supertest(app)
      .get(`/operations-fixes/${path}/1`)
      .set("Authorization", actor);
    assert.strictEqual(get.status, 404);
    const put = await supertest(app)
      .put(`/operations-fixes/${path}/1`)
      .set("Authorization", actor)
      .send({ titre: "Interdit", montant: 600, devise: "EUR" });
    assert.strictEqual(put.status, 404);
    const remove = await supertest(app)
      .delete(`/operations-fixes/${path}/1`)
      .set("Authorization", actor);
    assert.strictEqual(remove.status, 404);
  }
  assert.strictEqual(rows[0].montant, 240);
  const unpaid = await supertest(app)
    .put("/operations-fixes/charges/1")
    .set("Authorization", owner)
    .send({ ...input, pourcentagePersonnel: 0 });
  assert.strictEqual(unpaid.status, 200);
  const zero = await supertest(app)
    .get("/operations-fixes/charges/1")
    .set("Authorization", owner);
  assert.strictEqual(zero.body.data[0].montantMensuelPersonnel, "0.00");
  const legacy = await supertest(app)
    .post("/operations-fixes/charges")
    .set("Authorization", owner)
    .send({ titre: "Ancienne charge", montant: 100, devise: "EUR" });
  assert.strictEqual(legacy.body.data.periodicite, "MENSUELLE");
  assert.strictEqual(legacy.body.data.pourcentagePersonnel, 100);
  const forbiddenIncome = await supertest(app)
    .post("/operations-fixes/revenus")
    .set("Authorization", owner)
    .send(input);
  assert.strictEqual(forbiddenIncome.status, 400);
  // Categories are optional, owner-scoped and compatible with the fixed kind.
  for (const categoryId of [11, 12, 999]) {
    const denied = await supertest(app)
      .put("/operations-fixes/charges/1")
      .set("Authorization", owner)
      .send({ ...input, categoryId });
    assert.strictEqual(denied.status, 422);
    assert.strictEqual(
      denied.body.error.details.code,
      "INVALID_FIXED_CATEGORY"
    );
    assert.strictEqual(rows[0].categoryId ?? null, null);
  }
  for (const categoryId of [-1, 0, 1.5, 2147483648, "bad"]) {
    const invalid = await supertest(app)
      .post("/operations-fixes/charges")
      .set("Authorization", owner)
      .send({ ...input, categoryId });
    assert.strictEqual(invalid.status, 400);
  }
  const assigned = await supertest(app)
    .put("/operations-fixes/charges/1")
    .set("Authorization", owner)
    .send({ ...input, categoryId: 10 });
  assert.strictEqual(assigned.status, 200);
  const categorized = await supertest(app)
    .get("/operations-fixes/charges/1")
    .set("Authorization", owner);
  assert.deepStrictEqual(categorized.body.data[0].category, {
    id: 10,
    name: "Assurances",
    color: null,
    icon: "solid:shield-halved",
    fixedKind: "CHARGE",
  });
  assert.strictEqual(categorized.body.data[0].categoryId, 10);
  await supertest(app)
    .put("/operations-fixes/charges/1")
    .set("Authorization", owner)
    .send(input);
  assert.strictEqual(
    rows[0].categoryId,
    10,
    "old clients preserve category on PUT omission"
  );
  const cleared = await supertest(app)
    .put("/operations-fixes/charges/1")
    .set("Authorization", owner)
    .send({ ...input, categoryId: null });
  assert.strictEqual(cleared.status, 200);
  assert.strictEqual(rows[0].categoryId, null);
  const revenu = await supertest(app)
    .post("/operations-fixes/revenus")
    .set("Authorization", owner)
    .send({ titre: "Salaire", montant: 2000, devise: "EUR", categoryId: 11 });
  assert.strictEqual(revenu.status, 201);
  assert.strictEqual(revenu.body.data.category.icon, "solid:money-bill-wave");
  const personal = await supertest(app)
    .post("/operations-fixes/charges")
    .set("Authorization", owner)
    .send({ ...input, categoryId: 13 });
  assert.strictEqual(personal.status, 201);
  const removePersonal = await supertest(app)
    .delete(`/operations-fixes/charges/${personal.body.data.idOperationFixe}`)
    .set("Authorization", owner);
  assert.strictEqual(removePersonal.status, 200);
  const removed = await supertest(app)
    .delete("/operations-fixes/charges/1")
    .set("Authorization", owner);
  assert.strictEqual(removed.status, 200);
  assert.strictEqual(legacyExpense, 100);
  assert.ok(!rows.some((row) => row.idOperationFixe === 1));
  const unauthenticated = await supertest(app)
    .post("/operations-fixes/charges")
    .send(input);
  assert.strictEqual(unauthenticated.status, 401);
  console.log(
    "Fixed charge HTTP, persistence-boundary, ownership and compatibility tests passed"
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
