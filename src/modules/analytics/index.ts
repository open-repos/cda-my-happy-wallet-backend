import { prisma } from "../../database";
import { OperationAnalyticsUseCases } from "./application";
import { PrismaOperationAnalyticsRepository } from "./infrastructure";
import { OperationAnalyticsController } from "./presentation";

export const operationAnalyticsController = new OperationAnalyticsController(
  new OperationAnalyticsUseCases(new PrismaOperationAnalyticsRepository(prisma))
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";
