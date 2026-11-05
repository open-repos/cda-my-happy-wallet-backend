import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaOneOffOperationRepository } from "../../../src/modules/operations/infrastructure";
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
    "Title suggestion tests require the disposable myhappywallet_test database."
  );
}

const prisma = new PrismaClient();
const codec = new PaginationCursorCodec(
  "title-suggestion-test-secret-at-least-32-characters"
);
const repository = new PrismaOneOffOperationRepository(prisma, codec);

// Variantes égales à la casse ou aux accents près, doublons de lignes et
// caractères `%` et `_` : 8 suggestions distinctes attendues.
const ownerTitles = [
  "Loyer",
  "loyer",
  "LOYER",
  "Loyer",
  "Électricité",
  "electricite",
  "Remise 50%",
  "Remise 500",
  "Cinéma_soir",
  "Cinema soir",
  "Assurance",
  "Zoo",
] as const;
const otherTitles = ["Secret voisin", "Loyer"] as const;

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");

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
    firstname: "Suggestion",
    lastname: "Test",
    confirmpassword: "hashed-password",
  });
}

async function seed(ownerId: number, titles: readonly string[]) {
  const category = await prisma.operationCategory.create({
    data: { name: "Divers", userId: ownerId },
  });
  for (const [index, title] of titles.entries()) {
    await prisma.oneOffOperationRecord.create({
      data: {
        title,
        amount: "10.00",
        currency: "EUR",
        type: "DEPENSE",
        operationDate: new Date(`2026-10-${10 + index}T00:00:00.000Z`),
        userId: ownerId,
        categoryId: category.id,
      },
    });
  }
}

/** Parcourt toutes les pages et renvoie les libellés dans l'ordre reçu. */
async function collect(
  ownerId: number,
  query: string | undefined,
  limit: number
): Promise<{ titles: string[]; pages: number }> {
  const titles: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  for (; pages < 20; ) {
    const page = await repository.listTitleSuggestions(
      ownerId,
      { limit, cursor },
      query
    );
    pages += 1;
    titles.push(...page.data);
    if (!page.meta.hasNext) break;
    cursor = page.meta.nextCursor;
  }
  return { titles, pages };
}

async function run() {
  await cleanDatabase();
  const owner = await createOwner("suggest-owner@example.test");
  const other = await createOwner("suggest-other@example.test");
  await seed(owner.id, ownerTitles);
  await seed(other.id, otherTitles);

  // Une suggestion par libellé, sans doublon à la casse ou aux accents près,
  // et seulement pour le propriétaire.
  const all = await collect(owner.id, undefined, 50);
  assert.strictEqual(all.pages, 1);
  const folded = all.titles.map(fold);
  assert.strictEqual(new Set(folded).size, folded.length, "duplicate title");
  assert.deepStrictEqual(
    [...folded].sort(),
    [...new Set(ownerTitles.map(fold))].sort()
  );
  assert.ok(!all.titles.includes("Secret voisin"));
  for (const title of all.titles) {
    assert.ok(
      (ownerTitles as readonly string[]).includes(title),
      `${title} is not one of the stored variants`
    );
  }
  // Ordre alphabétique de A à Z selon le classement de la base.
  const initials = folded.map((title) => title[0]);
  assert.deepStrictEqual(initials, [...initials].sort());
  assert.strictEqual(folded[0], "assurance");
  assert.strictEqual(folded[folded.length - 1], "zoo");

  // Pagination sur plusieurs pages, sans doublon ni omission.
  for (const limit of [1, 3, 7]) {
    const paged = await collect(owner.id, undefined, limit);
    // La graphie représentante d'un groupe n'est pas garantie : on compare
    // les libellés normalisés.
    assert.deepStrictEqual(paged.titles.map(fold), folded, `limit ${limit}`);
    assert.strictEqual(paged.pages, Math.ceil(all.titles.length / limit));
  }

  // Recherche insensible à la casse et aux accents ; `%` et `_` littéraux.
  const search = async (query: string) =>
    (await collect(owner.id, query, 50)).titles.map(fold);
  assert.deepStrictEqual(await search("LOYER"), ["loyer"]);
  assert.deepStrictEqual(await search("ÉLEC"), ["electricite"]);
  assert.deepStrictEqual((await search("cinema")).length, 2);
  assert.deepStrictEqual(await search("%"), ["remise 50%"]);
  assert.deepStrictEqual(await search("50%"), ["remise 50%"]);
  assert.deepStrictEqual(await search("_"), ["cinema_soir"]);
  assert.deepStrictEqual(await search("a_s"), ["cinema_soir"]);
  assert.deepStrictEqual(await search("voisin"), []);
  const empty = await repository.listTitleSuggestions(
    owner.id,
    { limit: 10, cursor: null },
    "introuvable"
  );
  assert.deepStrictEqual(empty, {
    data: [],
    meta: { limit: 10, hasNext: false, nextCursor: null },
  });
  const filtered = await collect(owner.id, "e", 50);
  assert.deepStrictEqual(
    (await collect(owner.id, "e", 2)).titles.map(fold),
    filtered.titles.map(fold)
  );

  // Le curseur est lié au propriétaire, à `q` et à cette ressource.
  const first = await repository.listTitleSuggestions(
    owner.id,
    { limit: 2, cursor: null },
    "e"
  );
  const cursor = first.meta.nextCursor as string;
  assert.ok(cursor);
  await rejectsAsValidation(() =>
    repository.listTitleSuggestions(owner.id, { limit: 2, cursor }, "E")
  );
  await rejectsAsValidation(() =>
    repository.listTitleSuggestions(owner.id, { limit: 2, cursor }, undefined)
  );
  await rejectsAsValidation(() =>
    repository.listTitleSuggestions(other.id, { limit: 2, cursor }, "e")
  );
  await rejectsAsValidation(() =>
    repository.listByOwner(owner.id, { limit: 2, cursor })
  );
  const unfiltered = await repository.listTitleSuggestions(owner.id, {
    limit: 2,
    cursor: null,
  });
  await rejectsAsValidation(() =>
    repository.listTitleSuggestions(other.id, {
      limit: 2,
      cursor: unfiltered.meta.nextCursor,
    })
  );
  const operations = await repository.listByOwner(owner.id, {
    limit: 2,
    cursor: null,
  });
  await rejectsAsValidation(() =>
    repository.listTitleSuggestions(owner.id, {
      limit: 2,
      cursor: operations.meta.nextCursor,
    })
  );

  // Une position mal formée, même chiffrée avec le bon contexte, est refusée.
  for (const position of [[42], ["Loyer", 1], [""], ["a".repeat(51)]]) {
    const forged = codec.encode(
      {
        resource: "one-off-operation-title-suggestions",
        scope: `owner:${owner.id}`,
      },
      position
    );
    await rejectsAsValidation(() =>
      repository.listTitleSuggestions(owner.id, { limit: 2, cursor: forged })
    );
  }

  console.log("Operation title suggestion tests passed");
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
