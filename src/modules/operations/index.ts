import { prisma } from "../../database";
import {
  OneOffOperationUseCases,
  OperationCategoryUseCases,
} from "./application";
import {
  PrismaOneOffOperationRepository,
  PrismaOperationCategoryRepository,
} from "./infrastructure";
import { OneOffOperationController } from "./presentation";
import {
  BudgetCorrectionService,
  BudgetPeriodEngine,
} from "../budgetPeriods/application";
import { PrismaBudgetPeriodRepository } from "../budgetPeriods/infrastructure";

const categoryRepository = new PrismaOperationCategoryRepository(prisma);
const operationRepository = new PrismaOneOffOperationRepository(prisma);

export const oneOffOperationController = new OneOffOperationController(
  new OneOffOperationUseCases(
    operationRepository,
    categoryRepository,
    new BudgetCorrectionService(
      new BudgetPeriodEngine(new PrismaBudgetPeriodRepository(prisma))
    )
  ),
  new OperationCategoryUseCases(categoryRepository)
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";
