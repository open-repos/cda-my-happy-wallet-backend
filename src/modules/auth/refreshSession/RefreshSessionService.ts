import { createHash, randomUUID } from "crypto";
import { REFRESH_TOKEN_SECRET } from "../../../config/config";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { JsonWebTokenService } from "../token/JsonWebTokenService";
import { ITokenService } from "../token/TokenService.interface";
import { IRefreshSessionRepository } from "./RefreshSessionRepository.interface";
import { IRefreshSessionService } from "./RefreshSessionService.interface";
import {
  getRefreshTokenPayload,
  RefreshTokenPayload,
} from "./RefreshTokenPayload";

export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

export class RefreshSessionService implements IRefreshSessionService {
  constructor(
    private readonly repository: IRefreshSessionRepository,
    private readonly tokenService: ITokenService = new JsonWebTokenService("refresh"),
    private readonly secret: string = REFRESH_TOKEN_SECRET,
    private readonly now: () => Date = () => new Date(),
    private readonly generateId: () => string = randomUUID
  ) {}

  public async issue(userId: number): Promise<string> {
    const sessionId = this.generateId();
    const refreshToken = this.sign(userId, sessionId, REFRESH_TOKEN_TTL_SECONDS);

    await this.repository.create({
      id: sessionId,
      userId,
      tokenHash: this.hash(refreshToken),
      expiresAt: this.expiresAt(REFRESH_TOKEN_TTL_SECONDS),
    });

    return refreshToken;
  }

  public verify(token: string): RefreshTokenPayload {
    try {
      const decodedToken = this.tokenService.verify(token, this.secret);
      const payload = getRefreshTokenPayload(decodedToken);
      if (payload == null) {
        throw new Error("Invalid refresh token payload");
      }

      return payload;
    } catch {
      throw new ErrorException(ErrorCode.Unauthorized);
    }
  }

  public async rotate(
    token: string
  ): Promise<{
    userId: number;
    refreshToken: string;
    refreshTokenExpiresIn: number;
  }> {
    const payload = this.verify(token);
    const now = this.now();
    const refreshTokenExpiresIn = await this.renewedLifetimeSeconds(payload, now);
    if (refreshTokenExpiresIn <= 0) {
      await this.repository.revoke(payload.sessionId, payload.id);
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    const refreshToken = this.sign(
      payload.id,
      payload.sessionId,
      refreshTokenExpiresIn
    );
    const rotated = await this.repository.rotate({
      id: payload.sessionId,
      userId: payload.id,
      currentTokenHash: this.hash(token),
      nextTokenHash: this.hash(refreshToken),
      nextExpiresAt: this.expiresAt(refreshTokenExpiresIn, now),
    });

    if (!rotated) {
      await this.repository.revoke(payload.sessionId, payload.id);
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    return { userId: payload.id, refreshToken, refreshTokenExpiresIn };
  }

  public async revoke(token: string): Promise<void> {
    const payload = this.verify(token);
    await this.repository.revoke(payload.sessionId, payload.id);
  }

  private async renewedLifetimeSeconds(
    payload: RefreshTokenPayload,
    now: Date
  ): Promise<number> {
    const createdAt = await this.repository.findCreatedAt(
      payload.sessionId,
      payload.id
    );
    if (createdAt == null) {
      return 0;
    }

    const elapsedSeconds = (now.getTime() - createdAt.getTime()) / 1000;
    return Math.min(
      REFRESH_TOKEN_TTL_SECONDS,
      Math.floor(SESSION_ABSOLUTE_LIFETIME_SECONDS - elapsedSeconds)
    );
  }

  private sign(
    userId: number,
    sessionId: string,
    expiresInSeconds: number
  ): string {
    return this.tokenService.sign(
      { id: userId, sessionId },
      this.secret,
      {
        expiresIn: expiresInSeconds,
        jwtid: this.generateId(),
      }
    );
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private expiresAt(expiresInSeconds: number, now: Date = this.now()): Date {
    return new Date(now.getTime() + expiresInSeconds * 1000);
  }
}
