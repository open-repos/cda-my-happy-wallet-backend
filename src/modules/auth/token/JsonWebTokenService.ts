import jwt, {
  Secret,
  SignOptions,
  VerifyCallback,
  VerifyOptions,
} from "jsonwebtoken";
import { ITokenService } from "./TokenService.interface";
import { JWT_CONFIGURATION } from "../../../config/config";
import { JwtPurpose } from "../../../config/jwtConfig";

export class JsonWebTokenService implements ITokenService {
  constructor(private readonly purpose: JwtPurpose = "access") {
    if (!["access", "refresh", "registration"].includes(purpose)) {
      throw new Error("Invalid JWT purpose.");
    }
  }

  public sign(
    payload: string | object | Buffer,
    secret: Secret,
    options?: SignOptions
  ): string {
    return jwt.sign(payload, secret, {
      ...options,
      algorithm: "HS256",
      header: { ...options?.header, alg: "HS256" },
      issuer: JWT_CONFIGURATION.issuer,
      audience: JWT_CONFIGURATION.audiences[this.purpose],
    });
  }

  public verify(token: string, secret: Secret): string | object;
  public verify(token: string, secret: Secret, callback: VerifyCallback): void;
  public verify(
    token: string,
    secret: Secret,
    callback?: VerifyCallback
  ): string | object | void {
    const options: VerifyOptions = {
      algorithms: ["HS256"],
      issuer: JWT_CONFIGURATION.issuer,
      audience: JWT_CONFIGURATION.audiences[this.purpose],
    };
    if (callback) {
      return jwt.verify(token, secret, options, callback);
    }

    return jwt.verify(token, secret, options);
  }
}
