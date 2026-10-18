import assert from "assert";
import { prisma } from "../../../src/database";
import { MonthlyEvent } from "../../../src/modules/monthlyEvents/domain";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";
import { ErrorException } from "../../../src/utils/errors";

const databaseUrl = process.env.DATABASE_URL || "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
) {
  throw new Error(
    "Monthly event persistence tests require the disposable myhappywallet_test database."
  );
}

async function run() {
  const repository = new PrismaMonthlyEventRepository(prisma);
  await prisma.utilisateur.deleteMany({
    where: {
      email: { in: ["event-owner@test.local", "event-other@test.local"] },
    },
  });
  const owner = await prisma.utilisateur.create({
    data: {
      firstname: "Event",
      lastname: "Owner",
      email: "event-owner@test.local",
      password: "not-a-real-password",
      verified: true,
    },
  });
  const other = await prisma.utilisateur.create({
    data: {
      firstname: "Event",
      lastname: "Other",
      email: "event-other@test.local",
      password: "not-a-real-password",
      verified: true,
    },
  });
  try {
    const first = await repository.create(
      MonthlyEvent.create({
        ownerId: owner.id,
        title: "Loyer",
        amount: "800.00",
        currency: "EUR",
        kind: "DEPENSE",
        startDate: "2026-01-31",
        recurrence: "MENSUELLE",
      })
    );
    await repository.create(
      MonthlyEvent.create({
        ownerId: owner.id,
        title: "Prime",
        amount: "100.00",
        currency: "EUR",
        kind: "ENTREE",
        startDate: "2026-02-15",
        recurrence: "AUCUNE",
      })
    );
    await repository.create(
      MonthlyEvent.create({
        ownerId: other.id,
        title: "Privé",
        amount: "1.00",
        currency: "EUR",
        kind: "ENTREE",
        startDate: "2026-02-01",
        recurrence: "AUCUNE",
      })
    );

    assert.strictEqual(await repository.findById(first.id!, other.id), null);
    const firstPage = await repository.listByOwner(owner.id, {
      limit: 1,
      cursor: null,
    });
    assert.strictEqual(firstPage.data.length, 1);
    assert.strictEqual(firstPage.meta.hasNext, true);
    const secondPage = await repository.listByOwner(owner.id, {
      limit: 1,
      cursor: firstPage.meta.nextCursor,
    });
    assert.strictEqual(secondPage.data.length, 1);

    const occurrences = await repository.listOccurrences(owner.id, "2026-02", {
      limit: 10,
      cursor: null,
    });
    assert.deepStrictEqual(
      occurrences.data.map((item) => item.occurrenceDate),
      ["2026-02-15", "2026-02-28"]
    );
    assert.strictEqual(
      occurrences.data.some((item) => item.event.ownerId === other.id),
      false
    );

    const foreignUpdate = MonthlyEvent.create({
      id: first.id,
      ownerId: other.id,
      title: "Détourné",
      amount: "1.00",
      currency: "EUR",
      kind: "DEPENSE",
      startDate: "2026-01-31",
      recurrence: "MENSUELLE",
    });
    assert.strictEqual(await repository.update(foreignUpdate), null);

    // Trois ancrages distincts convergent au 29 février : le curseur doit
    // garder l'identifiant comme départage sans perdre ni répéter une règle.
    const expectedIds: number[] = [];
    for (const day of [29, 30, 31]) {
      const row = await repository.create(
        MonthlyEvent.create({
          ownerId: other.id,
          title: `Ancrage ${day}`,
          amount: "1.00",
          currency: "EUR",
          kind: "DEPENSE",
          startDate: `2028-01-${day}`,
          recurrence: "MENSUELLE",
          endDate: "2028-02-29",
        })
      );
      expectedIds.push(row.id!);
    }
    for (const [title, startDate, endDate] of [
      ["Déjà terminé", "2028-01-31", "2028-02-28"],
      ["Pas encore commencé", "2028-03-01", null],
    ] as const) {
      await repository.create(
        MonthlyEvent.create({
          ownerId: other.id,
          title,
          amount: "1.00",
          currency: "EUR",
          kind: "DEPENSE",
          startDate,
          recurrence: "MENSUELLE",
          endDate,
        })
      );
    }

    let cursor: string | null = null;
    let firstCursor: string | null = null;
    const actualIds: number[] = [];
    for (let index = 0; index < expectedIds.length; index += 1) {
      const page = await repository.listOccurrences(other.id, "2028-02", {
        limit: 1,
        cursor,
      });
      assert.deepStrictEqual(
        page.data.map((item) => item.occurrenceDate),
        ["2028-02-29"]
      );
      assert.strictEqual(page.data[0].event.ownerId, other.id);
      actualIds.push(page.data[0].event.id!);
      assert.strictEqual(page.meta.limit, 1);
      assert.strictEqual(page.meta.hasNext, index < expectedIds.length - 1);
      if (page.meta.hasNext) {
        assert.strictEqual(typeof page.meta.nextCursor, "string");
        assert.notStrictEqual(page.meta.nextCursor, cursor);
      } else {
        assert.strictEqual(page.meta.nextCursor, null);
      }
      cursor = page.meta.nextCursor;
      if (index === 0) firstCursor = cursor;
    }
    assert.deepStrictEqual(actualIds, expectedIds);
    assert.ok(firstCursor);
    const invalidCursor = (error: unknown) =>
      error instanceof ErrorException && error.status === 422;
    await assert.rejects(
      () =>
        repository.listOccurrences(other.id, "2028-03", {
          limit: 1,
          cursor: firstCursor,
        }),
      invalidCursor
    );
    await assert.rejects(
      () =>
        repository.listOccurrences(owner.id, "2028-02", {
          limit: 1,
          cursor: firstCursor,
        }),
      invalidCursor
    );
    await assert.rejects(
      () => repository.listByOwner(other.id, { limit: 1, cursor: firstCursor }),
      invalidCursor
    );
  } finally {
    await prisma.utilisateur.deleteMany({
      where: { id: { in: [owner.id, other.id] } },
    });
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  await prisma.$disconnect();
  throw error;
});
