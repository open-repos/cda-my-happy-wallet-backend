import { Secret, SignOptions, VerifyCallback } from "jsonwebtoken";

export interface ITokenService {
  sign(payload: string | object | Buffer, secret: Secret, options?: SignOptions): string;
  verify(token: string, secret: Secret): string | object;
  verify(token: string, secret: Secret, callback: VerifyCallback): void;
}
