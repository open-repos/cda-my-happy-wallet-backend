export type CreateRefreshSessionProps = {
  id: string;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
};

export type RotateRefreshSessionProps = {
  id: string;
  userId: number;
  currentTokenHash: string;
  nextTokenHash: string;
  nextExpiresAt: Date;
};

export interface IRefreshSessionRepository {
  create(props: CreateRefreshSessionProps): Promise<void>;
  rotate(props: RotateRefreshSessionProps): Promise<boolean>;
  revoke(id: string, userId: number): Promise<void>;
}
