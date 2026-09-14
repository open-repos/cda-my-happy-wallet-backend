import { prisma } from "../../../database";
import { PrismaRefreshSessionRepository } from "./PrismaRefreshSessionRepository";
import { RefreshSessionService } from "./RefreshSessionService";

export const refreshSessionRepository = new PrismaRefreshSessionRepository(
  prisma
);
export const refreshSessionService = new RefreshSessionService(
  refreshSessionRepository
);
