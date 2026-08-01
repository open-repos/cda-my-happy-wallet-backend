import { Request, Response } from "express";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { loginUserProps } from "../../../utils/validators/login.validator";
import { LOGIN_ACCESS_TOKEN_EXPIRES_IN_SECONDS } from "../../user/useCases/login/login";
import { REFRESH_TOKEN_TTL_SECONDS } from "../refreshSession/RefreshSessionService";
import { IRefreshSessionService } from "../refreshSession/RefreshSessionService.interface";
import { RenewedSession } from "../renewSession/RenewSession";

type LoginResult = {
  success: boolean;
  payload: Record<string, unknown>;
  refreshToken: string;
};

export interface NativeLoginUseCase {
  execute(props: loginUserProps): Promise<LoginResult | undefined>;
}

export interface NativeRenewSessionUseCase {
  execute(refreshToken: string): Promise<RenewedSession>;
}

export class NativeSessionController {
  constructor(
    private readonly login: NativeLoginUseCase,
    private readonly renewSession: NativeRenewSessionUseCase,
    private readonly refreshSessionService: Pick<IRefreshSessionService, "revoke">
  ) {}

  public async create(req: Request, res: Response): Promise<Response> {
    const result = await this.login.execute(req.body);
    if (result == null) {
      throw new ErrorException(ErrorCode.UnknownError);
    }

    return res.status(200).json({
      success: result.success,
      payload: {
        ...result.payload,
        accessTokenExpiresIn: LOGIN_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        refreshToken: result.refreshToken,
        refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    });
  }

  public async refresh(req: Request, res: Response): Promise<Response> {
    const result = await this.renewSession.execute(req.body.refreshToken);

    return res.status(200).json({
      success: true,
      payload: {
        user: result.user,
        accessToken: result.accessToken,
        expires: result.accessTokenExpires,
        accessTokenExpiresIn: result.accessTokenExpiresIn,
        refreshToken: result.refreshToken,
        refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      },
    });
  }

  public async revoke(req: Request, res: Response): Promise<Response> {
    try {
      await this.refreshSessionService.revoke(req.body.refreshToken);
    } catch {
      // Revocation is idempotent for invalid, expired or already revoked sessions.
    }

    return res.status(204).send();
  }
}
