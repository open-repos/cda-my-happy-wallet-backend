import assert from "assert";
import { PrismaClient } from "@prisma/client";
import { PrismaSavingsTrajectorySnapshot } from "../../../src/modules/financialGoals/infrastructure/PrismaSavingsTrajectorySnapshot";
import {
  SavingsTrajectoryRequest,
  SavingsTrajectoryService,
} from "../../../src/modules/financialGoals/application/SavingsTrajectoryService";

const databaseUrl = process.env.DATABASE_URL ?? "";
if (
  !databaseUrl.includes("myhappywallet_test") ||
  !databaseUrl.includes("my-happy-wallet-mysql-test")
)
  throw new Error(
    "Savings trajectory persistence requires the disposable MySQL test database"
  );
const prisma = new PrismaClient();
const email = "trajectory-snapshot@example.test";
const request: SavingsTrajectoryRequest = {
  currency: "EUR",
  scenario: "standard",
  months: 12,
  selectedGoalId: 0,
  currentRemainingVariableExpense: 10000,
  futureAdditionalVariableExpense: 70000,
  monthlySafetyMargin: 10000,
};
async function clean() {
  const user = await prisma.utilisateur.findUnique({ where: { email } });
  if (user === null) return;
  await prisma.operationFixe.deleteMany({ where: { userId: user.id } });
  await prisma.utilisateur.delete({ where: { id: user.id } });
}
async function run() {
  await clean();
  const owner = await prisma.utilisateur.create({
    data: {
      email,
      firstname: "Trajectory",
      lastname: "Test",
      password: "not-a-real-password",
    },
  });
  try {
    const salary = await prisma.operationFixe.create({
      data: {
        userId: owner.id,
        titre: "Salaire",
        montant: "3200.00",
        devise: "EUR",
        typeOperation: "REVENU",
      },
    });
    await prisma.operationFixe.create({
      data: {
        userId: owner.id,
        titre: "Charges",
        montant: "1600.00",
        devise: "EUR",
        typeOperation: "CHARGE",
      },
    });
    const goal = await prisma.objectifFinancier.create({
      data: {
        userId: owner.id,
        title: "Voyage familial",
        targetAmount: "6000",
        savedAmount: "1800",
        monthlyContribution: "350",
        currency: "EUR",
        targetDate: new Date("2027-05-31T00:00:00Z"),
      },
    });
    await prisma.objectifFinancier.create({
      data: {
        userId: owner.id,
        title: "Autre projet",
        targetAmount: "90000",
        savedAmount: "0",
        monthlyContribution: "150",
        currency: "EUR",
      },
    });
    await prisma.objectifFinancier.create({
      data: {
        userId: owner.id,
        title: "Devise distincte",
        targetAmount: "10000",
        savedAmount: "0",
        monthlyContribution: "999",
        currency: "USD",
      },
    });
    await prisma.evenementMensuel.create({
      data: {
        userId: owner.id,
        title: "Option novembre",
        amount: "200",
        currency: "EUR",
        startDate: new Date("2026-11-01T00:00:00Z"),
        status: "POTENTIEL",
      },
    });
    const expired = await prisma.evenementMensuel.create({
      data: {
        userId: owner.id,
        title: "Option expirée",
        amount: "200",
        currency: "EUR",
        startDate: new Date("2026-09-01T00:00:00Z"),
        status: "POTENTIEL",
      },
    });
    const selectedRequest = { ...request, selectedGoalId: goal.id };
    const service = new SavingsTrajectoryService(
      new PrismaSavingsTrajectorySnapshot(prisma)
    );
    const first = await service.calculate(
      owner.id,
      selectedRequest,
      "2026-10-25"
    );
    assert.strictEqual(first.goals.length, 2);
    assert.strictEqual(
      first.projections.reasonable.months[0].selectedTotalContribution,
      "650.00"
    );
    assert.strictEqual(
      first.projections.reasonable.estimatedReachMonth,
      "2027-05"
    );
    assert.strictEqual(
      await prisma.evenementMensuel.findUnique({ where: { id: expired.id } }),
      null
    );
    const fingerprint = async () =>
      JSON.stringify(
        await Promise.all([
          prisma.objectifFinancier.findMany({
            where: { userId: owner.id },
            orderBy: { id: "asc" },
          }),
          prisma.operationFixe.findMany({
            where: { userId: owner.id },
            orderBy: { idOperationFixe: "asc" },
          }),
          prisma.evenementMensuel.findMany({
            where: { userId: owner.id },
            orderBy: { id: "asc" },
          }),
          prisma.oneOffOperationRecord.findMany({
            where: { userId: owner.id },
          }),
          prisma.budgetPeriod.findMany({ where: { userId: owner.id } }),
        ])
      );
    const before = await fingerprint();
    const simulation = await service.calculate(
      owner.id,
      { ...selectedRequest, scenario: "simulation" },
      "2026-10-25"
    );
    assert.strictEqual(
      simulation.projections.reasonable.months[0].selectedTotalContribution,
      "450.00"
    );
    assert.strictEqual(await fingerprint(), before);
    // Pin the first SELECT snapshot, then change goals AND fixed income in another committed transaction.
    let writes = 0;
    const observed = prisma.$extends({
      query: {
        objectifFinancier: {
          async findMany({ args, query }) {
            const result = await query(args);
            if (writes++ === 0)
              await prisma.$transaction([
                prisma.objectifFinancier.update({
                  where: { id: goal.id },
                  data: { monthlyContribution: "450" },
                }),
                prisma.operationFixe.update({
                  where: { idOperationFixe: salary.idOperationFixe },
                  data: { montant: "4000" },
                }),
              ]);
            return result;
          },
        },
      },
    });
    const coherent = await new SavingsTrajectoryService(
      new PrismaSavingsTrajectorySnapshot(observed as unknown as PrismaClient)
    ).calculate(owner.id, selectedRequest, "2026-10-25");
    assert.strictEqual(coherent.goals[0].monthlyContribution, "350.00");
    assert.strictEqual(
      coherent.projections.maximum.current.reservedContributions,
      "500.00"
    );
    assert.strictEqual(
      coherent.projections.maximum.months[0].knownFlowBeforeGoals,
      "1600.00"
    );
    const fresh = await service.calculate(
      owner.id,
      selectedRequest,
      "2026-10-25"
    );
    assert.strictEqual(fresh.goals[0].monthlyContribution, "450.00");
    assert.strictEqual(
      fresh.projections.maximum.current.reservedContributions,
      "600.00"
    );
    assert.strictEqual(
      fresh.projections.maximum.months[0].knownFlowBeforeGoals,
      "2400.00"
    );
    console.log(
      "Savings trajectory MySQL: repeatable-read concurrency, no financial writes, expiry and scenarios passed"
    );
  } finally {
    await clean();
    await prisma.$disconnect();
  }
}
run().catch(async (error) => {
  await prisma.$disconnect();
  console.error(error);
  process.exitCode = 1;
});
