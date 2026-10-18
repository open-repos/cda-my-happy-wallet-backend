import { prisma } from "../../database";
import { BudgetPeriodEngine } from "./application";
import { PrismaBudgetPeriodRepository } from "./infrastructure";
import { BudgetPeriodController } from "./presentation";

const budgetPeriodRepository = new PrismaBudgetPeriodRepository(prisma);

export const budgetPeriodController = new BudgetPeriodController(
  new BudgetPeriodEngine(budgetPeriodRepository),
  budgetPeriodRepository
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";
