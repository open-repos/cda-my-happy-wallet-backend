import { Secret, SignOptions, VerifyCallback } from "jsonwebtoken";
import { ITokenService } from "../../src/modules/auth/token/TokenService.interface";

type SignedToken = {
  payload: string | object | Buffer;
  secret: Secret;
  options?: SignOptions;
};

type VerifiedToken = {
  token: string;
  secret: Secret;
};

export class FakeTokenService implements ITokenService {
  public signedTokens: SignedToken[] = [];
  public verifiedTokens: VerifiedToken[] = [];

  constructor(
    private readonly verifyResult: string | object = { id: 1 },
    private readonly verifyError: Error | null = null
  ) {}

  public sign(
    payload: string | object | Buffer,
    secret: Secret,
    options?: SignOptions
  ): string {
    this.signedTokens.push({ payload, secret, options });
    return "fake.jwt.token";
  }

  public verify(token: string, secret: Secret): string | object;
  public verify(token: string, secret: Secret, callback: VerifyCallback): void;
  public verify(
    token: string,
    secret: Secret,
    callback?: VerifyCallback
  ): string | object | void {
    this.verifiedTokens.push({ token, secret });

    if (callback) {
      callback(this.verifyError as any, this.verifyResult as any);
      return;
    }

    if (this.verifyError) {
      throw this.verifyError;
    }

    return this.verifyResult;
  }
}
