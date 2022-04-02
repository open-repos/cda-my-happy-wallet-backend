import { Result, ResultCode }  from './../../../../utils/results/';
import { UserRepo } from "../../userRepo";
import { ErrorException,ErrorCode } from '../../../../utils/errors/';
export class TokenNewPasswordUser {
  private userRepo: UserRepo;

  constructor(userRepo: UserRepo) {
    this.userRepo = userRepo;
  }

  public async execute(token: string) {

    // A enlever une fois le middleware executé
    const existUserResetToken =  await this.userRepo.existUserResetToken(token)
    console.log("existUserResetToken",existUserResetToken)
    if (!existUserResetToken) {
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
