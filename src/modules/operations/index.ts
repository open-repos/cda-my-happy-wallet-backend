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

const categoryRepository = new PrismaOperationCategoryRepository(prisma);
const operationRepository = new PrismaOneOffOperationRepository(prisma);

export const oneOffOperationController = new OneOffOperationController(
  new OneOffOperationUseCases(operationRepository, categoryRepository),
  new OperationCategoryUseCases(categoryRepository)
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";
