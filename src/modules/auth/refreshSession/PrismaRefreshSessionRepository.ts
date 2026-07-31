import { PrismaClient } from "@prisma/client";
import {
  CreateRefreshSessionProps,
  IRefreshSessionRepository,
  RotateRefreshSessionProps,
} from "./RefreshSessionRepository.interface";

export class PrismaRefreshSessionRepository
  implements IRefreshSessionRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  public async create(props: CreateRefreshSessionProps): Promise<void> {
    await this.prisma.refreshSession.create({ data: props });
  }

  public async rotate(props: RotateRefreshSessionProps): Promise<boolean> {
    const result = await this.prisma.refreshSession.updateMany({
      where: {
        id: props.id,
        userId: props.userId,
        tokenHash: props.currentTokenHash,
        revokedAt: null,
        expiresAt: { gte: new Date() },
      },
      data: {
        tokenHash: props.nextTokenHash,
        expiresAt: props.nextExpiresAt,
      },
    });

    return result.count === 1;
  }

  public async revoke(id: string, userId: number): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
