import assert from "assert";
import { prisma } from "../../../src/database";
import { MonthlyEvent } from "../../../src/modules/monthlyEvents/domain";
import { PrismaMonthlyEventRepository } from "../../../src/modules/monthlyEvents/infrastructure";

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
