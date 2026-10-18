import assert from "assert";
import { prisma } from "../../../src/database";
import { FinancialGoal } from "../../../src/modules/financialGoals/domain";
import { PrismaFinancialGoalRepository } from "../../../src/modules/financialGoals/infrastructure";

const emails = ["goal-owner@test.local", "goal-other@test.local"];

async function run() {
  const repository = new PrismaFinancialGoalRepository(prisma);
  await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
  const [owner, other] = await Promise.all(
    emails.map((email) =>
      prisma.utilisateur.create({
        data: {
          firstname: "Goal",
          lastname: "User",
          email,
          password: "not-a-real-password",
          verified: true,
        },
      })
    )
  );
  try {
    const goal = (ownerId: number, title: string, targetDate?: string) =>
      FinancialGoal.create({
        ownerId,
        title,
        targetAmount: "1200.50",
        savedAmount: "300.25",
        monthlyContribution: "150.00",
        currency: "EUR",
        targetDate,
      });
    const first = await repository.create(
      goal(owner.id, "Vacances", "2027-03-31")
    );
    await repository.create(goal(owner.id, "Voiture"));
    await repository.create(goal(other.id, "Privé"));

    assert.strictEqual(first.targetMinorUnits, 120050);
    assert.strictEqual(first.savedMinorUnits, 30025);
    assert.strictEqual(first.targetDate, "2027-03-31");
    assert.strictEqual(await repository.findById(first.id!, other.id), null);

    const firstPage = await repository.listByOwner(owner.id, {
      limit: 1,
      cursor: null,
    });
    assert.deepStrictEqual(
      firstPage.data.map((item) => item.title),
      ["Vacances"]
    );
    assert.strictEqual(firstPage.meta.hasNext, true);
    const secondPage = await repository.listByOwner(owner.id, {
      limit: 1,
      cursor: firstPage.meta.nextCursor,
    });
    assert.deepStrictEqual(
      secondPage.data.map((item) => item.title),
      ["Voiture"]
    );
    assert.strictEqual(secondPage.meta.hasNext, false);
    await assert.rejects(() =>
      repository.listByOwner(other.id, {
        limit: 1,
        cursor: firstPage.meta.nextCursor,
      })
    );

    const foreign = FinancialGoal.create({
      id: first.id,
      ownerId: other.id,
      title: "Détourné",
      targetAmount: "1.00",
      savedAmount: 0,
      monthlyContribution: 0,
      currency: "EUR",
    });
    assert.strictEqual(await repository.update(foreign), null);
    assert.strictEqual(await repository.delete(first.id!, other.id), false);

    const updated = await repository.update(
      FinancialGoal.create({
        id: first.id,
        ownerId: owner.id,
        title: "Vacances été",
        targetAmount: "1500.00",
        savedAmount: "1500.00",
        monthlyContribution: 0,
        currency: "EUR",
        targetDate: null,
      })
    );
    assert.strictEqual(updated?.title, "Vacances été");
    assert.strictEqual(updated?.targetDate, null);
    assert.strictEqual(await repository.delete(first.id!, owner.id), true);

    const plan = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      "EXPLAIN FORMAT=JSON SELECT * FROM `ObjectifFinancier` WHERE `userId` = ? AND `id` > ? ORDER BY `id` ASC LIMIT 51",
      owner.id,
      0
    );
    assert.ok(
      Object.values(plan[0] ?? {}).some((value) =>
        value.includes("ObjectifFinancier_userId_id_idx")
      )
    );

    await prisma.utilisateur.delete({ where: { id: other.id } });
    assert.strictEqual(
      await prisma.objectifFinancier.count({ where: { userId: other.id } }),
      0
    );
  } finally {
    await prisma.utilisateur.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  }
}

run().catch(async (error) => {
  await prisma.$disconnect();
  throw error;
});
