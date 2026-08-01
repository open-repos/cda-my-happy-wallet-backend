import { RefreshTokenPayload } from "./RefreshTokenPayload";

export interface IRefreshSessionService {
  issue(userId: number): Promise<string>;
  verify(token: string): RefreshTokenPayload;
  rotate(token: string): Promise<{ userId: number; refreshToken: string }>;
  revoke(token: string): Promise<void>;
}
