import { IUserRepository } from "../../userRepository.interface";
import { ErrorException, ErrorCode } from "../../../../utils/errors";
import { Result, ResultCode } from "../../../../utils/results";
import { REGISTER_TOKEN } from "./../../../../config/config";
import { ITokenService } from "../../../auth/token/TokenService.interface";
import { JsonWebTokenService } from "../../../auth/token/JsonWebTokenService";

type RegistrationTokenPayload = {
  email: string;
};

function isRegistrationTokenPayload(
  payload: string | object
): payload is RegistrationTokenPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "email" in payload &&
    typeof payload.email === "string"
  );
}

export class ConfirmRegistrationUser {
  private userRepo: IUserRepository;
  private tokenService: ITokenService;
  constructor(
    userRepo: IUserRepository,
    tokenService: ITokenService = new JsonWebTokenService()
  ) {
    this.userRepo = userRepo;
    this.tokenService = tokenService;
  }

  public async execute(id: string, token: string) {
    const userId = Number(id);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    const user = await this.userRepo.getUserById(userId);

    if (!user) {
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    let payload: string | object;
    try {
      payload = this.tokenService.verify(token, REGISTER_TOKEN);
    } catch {
      throw new ErrorException(
        ErrorCode.Unauthorized,
        "The register token is not valid."
      );
    }

    if (!isRegistrationTokenPayload(payload) || payload.email !== user.email) {
      throw new ErrorException(
        ErrorCode.Unauthorized,
        "The register token is not valid."
      );
    }

    const wasConfirmed = await this.userRepo.confirmRegistration(
      id,
      user.email
    );
    if (!wasConfirmed) {
      throw new ErrorException(
        ErrorCode.Conflict,
        "The registration link has already been used."
      );
    }
    const result = await new Result(
      ResultCode.Created,
      `Registration User is successfull`
    ).response_get();
    // const {register_token, ...userInfo}=newUserInfo
    return result;
  }
}
