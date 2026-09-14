import jwt, { Secret, SignOptions, VerifyCallback } from "jsonwebtoken";
import { ITokenService } from "./TokenService.interface";

export class JsonWebTokenService implements ITokenService {
  public sign(
    payload: string | object | Buffer,
    secret: Secret,
    options?: SignOptions
  ): string {
    return jwt.sign(payload, secret, { ...options, algorithm: "HS256" });
  }

  public verify(token: string, secret: Secret): string | object;
  public verify(token: string, secret: Secret, callback: VerifyCallback): void;
  public verify(
    token: string,
    secret: Secret,
    callback?: VerifyCallback
  ): string | object | void {
    if (callback) {
      return jwt.verify(token, secret, { algorithms: ["HS256"] }, callback);
    }

    return jwt.verify(token, secret, { algorithms: ["HS256"] });
  }
}
