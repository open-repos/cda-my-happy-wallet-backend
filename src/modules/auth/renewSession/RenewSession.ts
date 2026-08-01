import { ACCESS_TOKEN_SECRET } from "../../../config/config";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { IUserRepository } from "../../user/userRepository.interface";
import { IRefreshSessionService } from "../refreshSession/RefreshSessionService.interface";
import { ITokenService } from "../token/TokenService.interface";
import { JsonWebTokenService } from "../token/JsonWebTokenService";

export const RENEWED_ACCESS_TOKEN_EXPIRES_IN_SECONDS = 5 * 60;
const RENEWED_ACCESS_TOKEN_EXPIRES_IN = "5min";

export type RenewedSession = {
  userId: number;
  user: Record<string, unknown>;
  accessToken: string;
  accessTokenExpires: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
};

export class RenewSession {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly refreshSessionService: IRefreshSessionService,
    private readonly tokenService: ITokenService = new JsonWebTokenService(),
    private readonly accessTokenSecret: string = ACCESS_TOKEN_SECRET
  ) {}

  public async execute(
    refreshToken: string,
    expectedEmail?: string
  ): Promise<RenewedSession> {
    const tokenUser = this.refreshSessionService.verify(refreshToken);
    const user = await this.userRepository.getUserById(tokenUser.id);

    if (user == null || (expectedEmail != null && user.email !== expectedEmail)) {
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    const rotation = await this.refreshSessionService.rotate(refreshToken);
    if (rotation.userId !== user.id) {
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    const accessToken = this.tokenService.sign(
      { id: user.id },
      this.accessTokenSecret,
      { expiresIn: RENEWED_ACCESS_TOKEN_EXPIRES_IN }
    );
    const {
      id: _,
      password: __,
      resetToken: ___,
      resetTokenExpiration: ____,
      ...publicUser
    } = user;

    return {
      userId: user.id,
      user: publicUser,
      accessToken,
      accessTokenExpires: RENEWED_ACCESS_TOKEN_EXPIRES_IN,
      accessTokenExpiresIn: RENEWED_ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      refreshToken: rotation.refreshToken,
    };
  }
}
