import { prisma } from "../../database";
import { FinancialGoalUseCases } from "./application";
import { PrismaFinancialGoalRepository } from "./infrastructure";
import { FinancialGoalController } from "./presentation";

export const financialGoalController = new FinancialGoalController(
  new FinancialGoalUseCases(new PrismaFinancialGoalRepository(prisma))
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";
