import assert from "assert";
import { PrismaClient } from "@prisma/client";
import {
  OperationListFilter,
  OperationListSort,
} from "../../../src/modules/operations/application";
import { PrismaOneOffOperationRepository } from "../../../src/modules/operations/infrastructure";
import { OneOffOperation } from "../../../src/modules/operations/domain";
import { PaginationCursorCodec } from "../../../src/modules/pagination";
import { UserRepo } from "../../../src/modules/user/userRepo";
import { ErrorException } from "../../../src/utils/errors";
import { FakeMailer } from "../../fakes/FakeMailer";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Operation list tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();
const codec = new PaginationCursorCodec(
  "operation-list-test-secret-at-least-32-characters"
);
const repository = new PrismaOneOffOperationRepository(prisma, codec);

type Seed = Readonly<{
  title: string;
  amount: string;
  type: "DEPENSE" | "ENTREE";
  date: string;
  category: "courses" | "loisirs" | "zoo";
  currency?: string;
}>;

// Égalités voulues : deux « Loyer » (casse et accents compris), deux montants
// 30.00 et deux dates identiques, pour vérifier le départage par id.
const seeds: readonly Seed[] = [
  {
    title: "Loyer",
    amount: "650.00",
    type: "DEPENSE",
    date: "2026-10-01",
    category: "courses",
  },
  {
    title: "loyer",
    amount: "30.00",
    type: "DEPENSE",
    date: "2026-10-05",
    category: "loisirs",
  },
  {
    title: "Électricité",
    amount: "30.00",
    type: "DEPENSE",
    date: "2026-10-05",
    category: "courses",
  },
  {
    title: "electricite bis",
    amount: "45.10",
    type: "DEPENSE",
    date: "2026-09-12",
    category: "zoo",
  },
  {
    title: "Salaire",
    amount: "2100.00",
    type: "ENTREE",
    date: "2026-09-30",
    category: "loisirs",
  },
  {
    title: "Remise 50%",
    amount: "5.00",
    type: "ENTREE",
    date: "2026-08-15",
    category: "courses",
  },
  {
    title: "Remise 500",
    amount: "500.00",
    type: "ENTREE",
    date: "2026-08-16",
    category: "zoo",
  },
  {
    title: "Cinéma_soir",
    amount: "12.50",
    type: "DEPENSE",
    date: "2026-08-20",
    category: "loisirs",
  },
  {
    title: "Cinema soir",
    amount: "11.00",
    type: "DEPENSE",
    date: "2026-08-21",
    category: "loisirs",
  },
  {
    title: "Dollars",
    amount: "99.99",
    type: "DEPENSE",
    date: "2026-07-01",
    category: "zoo",
    currency: "USD",
  },
];

const rejectsAsValidation = async (
  action: () => Promise<unknown>
): Promise<void> => {
  await assert.rejects(
    action,
    (error: unknown) => error instanceof ErrorException && error.status === 422
  );
};

async function cleanDatabase() {
  await prisma.oneOffOperationRecord.deleteMany();
  await prisma.operationCategory.deleteMany();
  await prisma.utilisateur.deleteMany();
}

async function createOwner(email: string) {
  return new UserRepo(prisma, new FakeMailer()).create({
    email,
    password: "hashed-password",
    firstname: "List",
    lastname: "Test",
    confirmpassword: "hashed-password",
  });
}

async function seedOwner(ownerId: number) {
  const names = { courses: "Courses", loisirs: "Loisirs", zoo: "Zoo" };
  const categories: Record<string, number> = {};
  for (const [key, name] of Object.entries(names)) {
    categories[key] = (
      await prisma.operationCategory.create({ data: { name, userId: ownerId } })
    ).id;
  }
  for (const seed of seeds) {
    await prisma.oneOffOperationRecord.create({
      data: {
        title: seed.title,
        amount: seed.amount,
        currency: seed.currency ?? "EUR",
        type: seed.type,
        operationDate: new Date(`${seed.date}T00:00:00.000Z`),
        userId: ownerId,
        categoryId: categories[seed.category],
      },
    });
  }
  return categories;
}

/** Parcourt toutes les pages et vérifie l'absence de doublon. */
async function collect(
  ownerId: number,
  filter: OperationListFilter,
  sort: OperationListSort | undefined,
  limit = 3
): Promise<OneOffOperation[]> {
  const rows: OneOffOperation[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const result = await repository.listByOwner(
      ownerId,
      { limit, cursor },
      filter,
      sort
    );
    rows.push(...result.data);
    if (!result.meta.hasNext) break;
    cursor = result.meta.nextCursor;
  }
  const ids = rows.map((row) => row.id);
  assert.strictEqual(new Set(ids).size, ids.length, "duplicate row");
  return rows;
}

async function run() {
  await cleanDatabase();
  const owner = await createOwner("list-owner@example.test");
  const other = await createOwner("list-other@example.test");
  const categories = await seedOwner(owner.id);
  const otherCategories = await seedOwner(other.id);

  const all = await collect(owner.id, {}, undefined, 50);
  assert.strictEqual(all.length, seeds.length);
  const byId = new Map(all.map((row) => [row.id as number, row]));
  const categoryName = new Map([
    [categories.courses, "Courses"],
    [categories.loisirs, "Loisirs"],
    [categories.zoo, "Zoo"],
  ]);
  const amountOf = (row: OneOffOperation) => row.money.minorUnits;
  const fold = (text: string) =>
    text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
  const compare = (a: string | number, b: string | number) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : fold(String(a)) < fold(String(b))
      ? -1
      : fold(String(a)) > fold(String(b))
      ? 1
      : 0;
  const keys: Record<
    OperationListSort["field"],
    (row: OneOffOperation) => string | number
  > = {
    date: (row) => row.operationDate,
    title: (row) => row.title,
    category: (row) => categoryName.get(row.categoryId) as string,
    amount: amountOf,
  };

  // Ordre par défaut inchangé : date décroissante puis id décroissant.
  const defaultOrder = await collect(owner.id, {}, undefined);
  assert.deepStrictEqual(
    defaultOrder.map((row) => row.id),
    [...all]
      .sort(
        (a, b) =>
          compare(b.operationDate, a.operationDate) ||
          (b.id as number) - (a.id as number)
      )
      .map((row) => row.id)
  );

  // Chaque tri, dans les deux sens, sur des pages de 3, départagé par id.
  for (const field of ["date", "title", "category", "amount"] as const) {
    for (const order of ["asc", "desc"] as const) {
      const sign = order === "asc" ? 1 : -1;
      const expected = [...all]
        .sort(
          (a, b) =>
            sign *
            (compare(keys[field](a), keys[field](b)) ||
              (a.id as number) - (b.id as number))
        )
        .map((row) => row.id);
      const listed = await collect(owner.id, {}, { field, order });
      assert.deepStrictEqual(
        listed.map((row) => row.id),
        expected,
        `${field} ${order}`
      );
    }
  }

  const titles = async (filter: OperationListFilter) =>
    (await collect(owner.id, filter, { field: "title", order: "asc" }))
      .map((row) => row.title)
      .sort();

  // Texte contenu, insensible à la casse et aux accents.
  assert.deepStrictEqual(
    await titles({ title: "ELEC" }),
    ["electricite bis", "Électricité"].sort()
  );
  assert.deepStrictEqual(
    await titles({ title: "loyer" }),
    ["Loyer", "loyer"].sort()
  );
  assert.deepStrictEqual(
    await titles({ title: "cinema" }),
    ["Cinema soir", "Cinéma_soir"].sort()
  );
  // `%` et `_` sont des caractères ordinaires, pas des jokers.
  assert.deepStrictEqual(await titles({ title: "50%" }), ["Remise 50%"]);
  assert.deepStrictEqual(await titles({ title: "a_s" }), ["Cinéma_soir"]);
  assert.deepStrictEqual(await titles({ title: "%" }), ["Remise 50%"]);

  // Catégories (OU), type, montants inclusifs, filtres combinés (ET).
  assert.deepStrictEqual(
    await titles({ categoryIds: [categories.zoo] }),
    ["Dollars", "Remise 500", "electricite bis"].sort()
  );
  assert.deepStrictEqual(
    await titles({ categoryIds: [categories.zoo, categories.courses] }),
    [
      "Dollars",
      "Loyer",
      "Remise 50%",
      "Remise 500",
      "electricite bis",
      "Électricité",
    ].sort()
  );
  assert.deepStrictEqual(
    await titles({ kind: "ENTREE" }),
    ["Remise 50%", "Remise 500", "Salaire"].sort()
  );
  assert.deepStrictEqual(
    await titles({ minAmount: "30.00", maxAmount: "45.10" }),
    ["electricite bis", "loyer", "Électricité"].sort()
  );
  assert.deepStrictEqual(
    await titles({
      categoryIds: [categories.courses, categories.loisirs],
      kind: "DEPENSE",
      minAmount: "12.00",
      from: "2026-08-01",
      to: "2026-10-31",
      currency: "EUR",
    }),
    ["Cinéma_soir", "Loyer", "loyer", "Électricité"].sort()
  );

  // Isolation : les catégories d'un autre propriétaire ne révèlent rien.
  assert.deepStrictEqual(
    await titles({ categoryIds: [otherCategories.zoo] }),
    []
  );
  assert.strictEqual(
    (await collect(other.id, {}, { field: "amount", order: "desc" })).length,
    seeds.length
  );
  for (const row of await collect(
    owner.id,
    { title: "e" },
    { field: "category", order: "asc" }
  )) {
    assert.ok(byId.has(row.id as number), "row of another owner");
  }

  // Un curseur ne passe ni d'un tri à l'autre, ni d'un filtre à l'autre.
  const first = await repository.listByOwner(
    owner.id,
    { limit: 2, cursor: null },
    {},
    { field: "amount", order: "asc" }
  );
  const cursor = first.meta.nextCursor as string;
  assert.ok(cursor);
  const reuse = (filter: OperationListFilter, sort?: OperationListSort) =>
    rejectsAsValidation(() =>
      repository.listByOwner(owner.id, { limit: 2, cursor }, filter, sort)
    );
  await reuse({}, { field: "amount", order: "desc" });
  await reuse({}, { field: "title", order: "asc" });
  await reuse({}, undefined);
  await reuse({ title: "loyer" }, { field: "amount", order: "asc" });
  await reuse(
    { categoryIds: [categories.zoo] },
    { field: "amount", order: "asc" }
  );
  await reuse({ kind: "DEPENSE" }, { field: "amount", order: "asc" });
  await reuse({ minAmount: "1.00" }, { field: "amount", order: "asc" });
  await rejectsAsValidation(() =>
    repository.listByOwner(
      other.id,
      { limit: 2, cursor },
      {},
      { field: "amount", order: "asc" }
    )
  );
  // L'ordre des catégories ne change pas la liste, donc pas le curseur.
  const byCategories = await repository.listByOwner(
    owner.id,
    { limit: 2, cursor: null },
    { categoryIds: [categories.courses, categories.zoo] },
    { field: "date", order: "asc" }
  );
  const sameList = await repository.listByOwner(
    owner.id,
    { limit: 2, cursor: byCategories.meta.nextCursor },
    { categoryIds: [categories.zoo, categories.courses] },
    { field: "date", order: "asc" }
  );
  assert.strictEqual(sameList.data.length, 2);

  // Un curseur de l'ordre par défaut, sans nouveau filtre, garde son format :
  // son périmètre est identique à celui d'avant #165.
  const legacy = await repository.listByOwner(owner.id, {
    limit: 2,
    cursor: null,
  });
  const legacyNext = await repository.listByOwner(
    owner.id,
    { limit: 2, cursor: legacy.meta.nextCursor },
    { from: undefined }
  );
  assert.strictEqual(legacyNext.data.length, 2);
  assert.deepStrictEqual(
    codec.decode(
      { resource: "one-off-operations", scope: `owner:${owner.id}` },
      legacy.meta.nextCursor as string
    ),
    [
      all.find((row) => row.id === legacy.data[1].id)?.operationDate,
      legacy.data[1].id,
    ]
  );

  console.log("One-off operation list sort and filter tests passed");
}

run()
  .finally(async () => {
    await cleanDatabase();
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
