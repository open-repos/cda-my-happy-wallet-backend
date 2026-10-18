import { prisma } from "../../database";
import { MonthlyEventUseCases } from "./application";
import { PrismaMonthlyEventRepository } from "./infrastructure";
import { MonthlyEventController } from "./presentation";

export const monthlyEventController = new MonthlyEventController(
  new MonthlyEventUseCases(new PrismaMonthlyEventRepository(prisma))
);

export * from "./application";
export * from "./domain";
export * from "./infrastructure";
export * from "./presentation";
