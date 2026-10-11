/// <reference path="../../../src/utils/custom.d.ts" />

import assert from "assert";
import { NextFunction, Request, Response } from "express";
import supertest from "supertest";
import { Prisma, PrismaClient, TypeOperationEnum } from "@prisma/client";
import { errorHandler } from "../../../src/middlewares/errorHandler.middleware";
import { OperationAnalyticsUseCases } from "../../../src/modules/analytics/application";
import {
  PrismaOperationAnalyticsRepository,
  analyticsSql,
} from "../../../src/modules/analytics/infrastructure";
import { OperationAnalyticsController } from "../../../src/modules/analytics/presentation";
import { createAnalyticsRouter } from "../../../src/routes/analytics";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const express = require("express") as typeof import("express");

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error("Analytics API tests require the disposable test database.");
}

const prisma = new PrismaClient();
const emails = [
  "analytics-api-owner@example.test",
  "analytics-api-other@example.test",
];

const cleanDatabase = async () => {
  const users = await prisma.utilisateur.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  await prisma.oneOffOperationRecord.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.operationCategory.deleteMany({
    where: { userId: { in: userIds } },
  });
  await prisma.utilisateur.deleteMany({ where: { id: { in: userIds } } });
};

const buildApp = (ids: { owner: number; other: number }) => {
  const authenticate = (req: Request, _: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer owner")
      req.user = { id: ids.owner };
    else if (req.headers.authorization === "Bearer other")
      req.user = { id: ids.other };
    else return next(new ErrorException(ErrorCode.Unauthorized));
    next();
  };
  const app = express();
  app.use(
    createAnalyticsRouter(
      new OperationAnalyticsController(
        new OperationAnalyticsUseCases(
          new PrismaOperationAnalyticsRepository(prisma)
        )
      ),
      authenticate
    )
  );
  app.use(errorHandler);
  return app;
};

type Seed = [string, string, TypeOperationEnum, number, string?];

const run = async () => {
  await cleanDatabase();
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          firstname: "Analytics",
          lastname: "Api",
          email,
          password: "not-a-real-password",
        },
      })
    )
  );
  const food = await prisma.operationCategory.create({
    data: { name: "Alimentation", color: "#55AA22", userId: owner.id },
  });
  const leisure = await prisma.operationCategory.create({
    data: { name: "Loisirs", userId: owner.id },
  });
  const otherCategory = await prisma.operationCategory.create({
    data: { name: "Autre", userId: other.id },
  });
  // [date, montant, sens, catégorie, devise]
  const seeds: Seed[] = [
    ["2028-02-28", "10.10", TypeOperationEnum.DEPENSE, food.id],
    ["2028-02-29", "0.01", TypeOperationEnum.DEPENSE, food.id],
    ["2028-02-29", "20.00", TypeOperationEnum.DEPENSE, leisure.id],
    ["2028-03-01", "100.00", TypeOperationEnum.ENTREE, food.id],
    ["2028-03-05", "5.55", TypeOperationEnum.DEPENSE, leisure.id], // dimanche
    ["2028-03-06", "7.00", TypeOperationEnum.DEPENSE, food.id], // lundi
    ["2028-03-06", "999.99", TypeOperationEnum.DEPENSE, food.id, "USD"],
    ["2027-12-31", "3.00", TypeOperationEnum.DEPENSE, food.id],
  ];
  await prisma.oneOffOperationRecord.createMany({
    data: seeds.map(([date, amount, type, categoryId, currency]) => ({
      title: "Opération test",
      amount,
      currency: currency ?? "EUR",
      type,
      operationDate: new Date(`${date}T00:00:00.000Z`),
      userId: owner.id,
      categoryId,
    })),
  });
  await prisma.oneOffOperationRecord.create({
    data: {
      title: "Autre compte",
      amount: "500.00",
      currency: "EUR",
      type: TypeOperationEnum.DEPENSE,
      operationDate: new Date("2028-02-29T00:00:00.000Z"),
      userId: other.id,
      categoryId: otherCategory.id,
    },
  });

  const app = buildApp({ owner: owner.id, other: other.id });
  const get = (url: string, token = "owner") =>
    supertest(app).get(url).set("Authorization", `Bearer ${token}`);
  const base = "/analytics/operations?currency=EUR";

  // Authentification et validation.
  assert.strictEqual(
    (
      await supertest(app).get(
        `${base}&from=2028-01-01&to=2028-01-31&groupBy=day`
      )
    ).status,
    401
  );
  for (const url of [
    `${base}&from=2028-02-30&to=2028-03-01&groupBy=day`,
    `${base}&from=2028-03-01&to=2028-02-01&groupBy=day`,
    `${base}&from=2028-01-01&to=2028-01-31&groupBy=hour`,
    `${base}&from=2028-01-01&to=2028-01-31&groupBy=category&splitBy=kind`,
    `${base}&from=2028-01-01&to=2028-01-31&groupBy=day&kind=ALL`,
    `${base}&from=2028-01-01&to=2028-01-31&groupBy=day&ownerId=1`,
    `/analytics/operations?currency=EURO&from=2028-01-01&to=2028-01-31&groupBy=day`,
    `/analytics/operations?from=2028-01-01&to=2028-01-31&groupBy=day`,
  ]) {
    assert.strictEqual((await get(url)).status, 422, url);
  }
  const tooLarge = await get(
    `${base}&from=2027-01-01&to=2028-01-02&groupBy=day`
  );
  assert.strictEqual(tooLarge.status, 422);
  assert.strictEqual(
    tooLarge.body.error.details.code,
    "ANALYTICS_RANGE_TOO_LARGE"
  );
  const tooManyPoints = await get(
    `${base}&from=2028-01-01&to=2028-12-31&groupBy=day&splitBy=kind`
  );
  assert.strictEqual(tooManyPoints.status, 422);
  assert.strictEqual(
    tooManyPoints.body.error.details.code,
    "ANALYTICS_RANGE_TOO_LARGE"
  );

  // Jours d'une fin février bissextile : zéros et centimes exacts.
  const days = await get(`${base}&from=2028-02-28&to=2028-03-01&groupBy=day`);
  assert.strictEqual(days.status, 200);
  assert.deepStrictEqual(
    days.body.data.buckets.map(
      (bucket: {
        key: string;
        expense: string;
        income: string;
        net: string;
      }) => [bucket.key, bucket.expense, bucket.income, bucket.net]
    ),
    [
      ["2028-02-28", "10.10", "0.00", "-10.10"],
      ["2028-02-29", "20.01", "0.00", "-20.01"],
      ["2028-03-01", "0.00", "100.00", "100.00"],
    ]
  );
  assert.ok(!("ownerId" in days.body.data));

  // Semaines ISO : le dimanche 5 mars reste dans la semaine du lundi 28 février.
  const weeks = await get(`${base}&from=2028-02-28&to=2028-03-06&groupBy=week`);
  assert.deepStrictEqual(
    weeks.body.data.buckets.map(
      (bucket: { key: string; expense: string; count: number }) => [
        bucket.key,
        bucket.expense,
        bucket.count,
      ]
    ),
    [
      ["2028-02-28", "35.66", 5],
      ["2028-03-06", "7.00", 1],
    ]
  );

  // Années : 31 décembre et devise USD exclus de la mauvaise année ou devise.
  const years = await get(`${base}&from=2027-01-01&to=2028-12-31&groupBy=year`);
  assert.deepStrictEqual(
    years.body.data.buckets.map((bucket: { key: string; expense: string }) => [
      bucket.key,
      bucket.expense,
    ]),
    [
      ["2027", "3.00"],
      ["2028", "42.66"],
    ]
  );

  // Catégories : libellés, couleurs, tri par volume, isolation du propriétaire.
  const categories = await get(
    `${base}&from=2028-01-01&to=2028-12-31&groupBy=category`
  );
  assert.deepStrictEqual(
    categories.body.data.buckets.map(
      (bucket: {
        key: string;
        label: string;
        color: string | null;
        net: string;
      }) => [bucket.key, bucket.label, bucket.color, bucket.net]
    ),
    [
      [String(food.id), "Alimentation", "#55AA22", "82.89"],
      [String(leisure.id), "Loisirs", null, "-25.55"],
    ]
  );

  // Ventilation mensuelle des seules dépenses par catégorie.
  const split = await get(
    `${base}&from=2028-02-01&to=2028-03-31&groupBy=month&splitBy=category&kind=DEPENSE`
  );
  assert.deepStrictEqual(
    split.body.data.buckets.map(
      (bucket: {
        key: string;
        expense: string;
        series: { label: string; expense: string }[];
      }) => [
        bucket.key,
        bucket.expense,
        bucket.series.map((serie) => [serie.label, serie.expense]),
      ]
    ),
    [
      [
        "2028-02",
        "30.11",
        [
          ["Loisirs", "20.00"],
          ["Alimentation", "10.11"],
        ],
      ],
      [
        "2028-03",
        "12.55",
        [
          ["Loisirs", "5.55"],
          ["Alimentation", "7.00"],
        ],
      ],
    ]
  );

  // Types : les deux sens, même sans opération.
  const kinds = await get(`${base}&from=2028-01-01&to=2028-01-31&groupBy=kind`);
  assert.deepStrictEqual(
    kinds.body.data.buckets.map((bucket: { key: string; count: number }) => [
      bucket.key,
      bucket.count,
    ]),
    [
      ["DEPENSE", 0],
      ["ENTREE", 0],
    ]
  );

  // L'autre compte ne voit que sa propre dépense.
  const otherView = await get(
    `${base}&from=2028-02-29&to=2028-02-29&groupBy=day`,
    "other"
  );
  assert.strictEqual(otherView.body.data.buckets[0].expense, "500.00");

  // Jour du passage à l'heure d'hiver à Paris, processus en Europe/Paris.
  process.env.TZ = "Europe/Paris";
  await prisma.oneOffOperationRecord.create({
    data: {
      title: "Heure d'hiver",
      amount: "12.34",
      currency: "EUR",
      type: TypeOperationEnum.DEPENSE,
      operationDate: new Date("2026-10-25T00:00:00.000Z"),
      userId: owner.id,
      categoryId: food.id,
    },
  });
  const dst = await get(`${base}&from=2026-10-24&to=2026-10-26&groupBy=day`);
  assert.deepStrictEqual(
    dst.body.data.buckets.map((bucket: { key: string; expense: string }) => [
      bucket.key,
      bucket.expense,
    ]),
    [
      ["2026-10-24", "0.00"],
      ["2026-10-25", "12.34"],
      ["2026-10-26", "0.00"],
    ]
  );

  // Le plan d'exécution de la requête réelle s'appuie sur un index du propriétaire.
  // Prisma nomme les colonnes d'EXPLAIN par position : f2 = table,
  // f4 = type d'accès, f6 = index retenu.
  const plan = await prisma.$queryRaw<Record<string, unknown>[]>(
    Prisma.sql`EXPLAIN ${analyticsSql(owner.id, {
      from: "2028-01-01",
      to: "2028-12-31",
      currency: "EUR",
      groupBy: "week",
      splitBy: "category",
      kind: "DEPENSE",
    })}`
  );
  const scan = plan.find((row) => row.f2 === "o");
  assert.ok(scan !== undefined, "operations table in plan");
  assert.ok(
    typeof scan.f6 === "string" &&
      scan.f6.startsWith("OneOffOperationRecord_userId"),
    `owner index used: ${String(scan.f6)}`
  );
  assert.notStrictEqual(scan.f4, "ALL", "no full table scan");

  await cleanDatabase();
  console.log("Operation analytics API tests passed");
};

run()
  .catch(async (error) => {
    console.error(error);
    await cleanDatabase();
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
