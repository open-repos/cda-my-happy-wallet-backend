import { Result, ResultCode }  from './../../../../utils/results/';
import { IUserRepository } from "../../userRepository.interface";
import { ErrorException,ErrorCode } from '../../../../utils/errors/';
import { parseResetToken } from '../../../auth/resetToken';
export class TokenNewPasswordUser {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  public async execute(token: unknown) {

    const resetToken = parseResetToken(token);
    const hasValidResetToken = await this.userRepo.hasValidResetToken(resetToken)
    if (!hasValidResetToken) {
        throw new ErrorException(ErrorCode.Unauthorized,"Link to reset password expired");
    }

    return await new Result(ResultCode.Read).response_update()

    // const hashPassword = await argon2.hash(password);
    // console.log("hashed password", hashPassword);

    // password = hashPassword;

    // const result = await this.userRepo.newPassword(password, token);
    // return result;
  }
}
