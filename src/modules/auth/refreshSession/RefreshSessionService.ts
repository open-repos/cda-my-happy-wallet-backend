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

const REFRESH_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRES_IN = "15min";

export class RefreshSessionService implements IRefreshSessionService {
  constructor(
    private readonly repository: IRefreshSessionRepository,
    private readonly tokenService: ITokenService = new JsonWebTokenService(),
    private readonly secret: string = REFRESH_TOKEN_SECRET as string,
    private readonly now: () => Date = () => new Date(),
    private readonly generateId: () => string = randomUUID
  ) {}

  public async issue(userId: number): Promise<string> {
    const sessionId = this.generateId();
    const refreshToken = this.sign(userId, sessionId);

    await this.repository.create({
      id: sessionId,
      userId,
      tokenHash: this.hash(refreshToken),
      expiresAt: this.expiresAt(),
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
  ): Promise<{ userId: number; refreshToken: string }> {
    const payload = this.verify(token);
    const refreshToken = this.sign(payload.id, payload.sessionId);
    const rotated = await this.repository.rotate({
      id: payload.sessionId,
      userId: payload.id,
      currentTokenHash: this.hash(token),
      nextTokenHash: this.hash(refreshToken),
      nextExpiresAt: this.expiresAt(),
    });

    if (!rotated) {
      await this.repository.revoke(payload.sessionId, payload.id);
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    return { userId: payload.id, refreshToken };
  }

  public async revoke(token: string): Promise<void> {
    const payload = this.verify(token);
    await this.repository.revoke(payload.sessionId, payload.id);
  }

  private sign(userId: number, sessionId: string): string {
    return this.tokenService.sign(
      { id: userId, sessionId },
      this.secret,
      {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        jwtid: this.generateId(),
      }
    );
  }

  private hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private expiresAt(): Date {
    return new Date(this.now().getTime() + REFRESH_TOKEN_TTL_MS);
  }
}
