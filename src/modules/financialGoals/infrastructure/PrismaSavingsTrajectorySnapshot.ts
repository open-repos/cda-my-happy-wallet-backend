import { Prisma, PrismaClient } from "@prisma/client";
import { BudgetForecastService } from "../../budgetPeriods/application/BudgetForecastService";
import { PrismaBudgetPeriodRepository } from "../../budgetPeriods/infrastructure";
import { expirePotentialEvents } from "../../monthlyEvents/infrastructure/potentialEventMaintenance";
import {
  SavingsTrajectoryRequest,
  SavingsTrajectorySnapshot,
} from "../application/SavingsTrajectoryService";
import { PrismaFinancialGoalRepository } from "./PrismaFinancialGoalRepository";

export class PrismaSavingsTrajectorySnapshot
  implements SavingsTrajectorySnapshot
{
  public constructor(private readonly prisma: PrismaClient) {}

  public async read(
    ownerId: number,
    request: SavingsTrajectoryRequest,
    today: string
  ) {
    await expirePotentialEvents(this.prisma, ownerId, today);
    return this.prisma.$transaction(
      async (tx) => {
        const goals = await new PrismaFinancialGoalRepository(
          tx
        ).listForSavingsCapacity(ownerId, request.currency);
        const forecast = await new BudgetForecastService(
          new PrismaBudgetPeriodRepository(tx)
        ).forecast(
          ownerId,
          today.slice(0, 7),
          request.months,
          request.currency,
          today,
          request.scenario
        );
        return { goals, months: forecast.months };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 30000,
      }
    );
  }
}
