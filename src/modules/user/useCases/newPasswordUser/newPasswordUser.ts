import { IUserRepository } from "../../userRepository.interface";
import argon2 from "argon2"
import { ErrorCode, ErrorException } from "../../../../utils/errors";
import { Result, ResultCode } from "../../../../utils/results";
import { parseResetToken } from "../../../auth/resetToken";
export class NewPasswordUser {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  public async execute(password: string, token: unknown) {

    const resetToken = parseResetToken(token);
    const hasValidResetToken = await this.userRepo.hasValidResetToken(resetToken);
    if (!hasValidResetToken) {
      throw new ErrorException(ErrorCode.Unauthorized);
    }

    const hashPassword = await argon2.hash(password);

    password = hashPassword;

    await this.userRepo.newPassword(password, resetToken);
    return await new Result(ResultCode.Created,`New password created`).response_post();
  }
}
