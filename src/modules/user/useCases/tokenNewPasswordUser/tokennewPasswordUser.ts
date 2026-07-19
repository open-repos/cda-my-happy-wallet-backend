import { Result, ResultCode }  from './../../../../utils/results/';
import { IUserRepository } from "../../userRepository.interface";
import { ErrorException,ErrorCode } from '../../../../utils/errors/';
export class TokenNewPasswordUser {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  public async execute(token: string) {

    // A enlever une fois le middleware executé
    const existUserResetToken =  await this.userRepo.existUserResetToken(token)
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
