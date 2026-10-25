import { ListOccurrenceResolutions } from "./application/ListOccurrenceResolutions";
import { OccurrenceResolutionReadController } from "./presentation/OccurrenceResolutionReadController";
import { prisma } from "../../database";
import { PrismaBudgetPeriodRepository } from "../budgetPeriods/infrastructure";
import { PrismaMonthlyEventRepository } from "../monthlyEvents/infrastructure";
import { PrismaOperationCategoryRepository } from "../operations/infrastructure";
import { EventOccurrenceUseCases } from "./application";
import { PrismaOccurrenceResolutionRepository } from "./infrastructure";
import { EventOccurrenceController } from "./presentation";

export const eventOccurrenceController = new EventOccurrenceController(
  new EventOccurrenceUseCases(
    new PrismaMonthlyEventRepository(prisma),
    new PrismaOperationCategoryRepository(prisma),
    new PrismaBudgetPeriodRepository(prisma),
    new PrismaOccurrenceResolutionRepository(prisma)
  )
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";

export const occurrenceResolutionReadController =
  new OccurrenceResolutionReadController(
    new ListOccurrenceResolutions(
      new PrismaOccurrenceResolutionRepository(prisma)
    )
  );
export { OccurrenceResolutionReadController } from "./presentation/OccurrenceResolutionReadController";
