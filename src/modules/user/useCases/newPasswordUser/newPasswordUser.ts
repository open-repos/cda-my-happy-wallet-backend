import { IUserRepository } from "../../userRepository.interface";
import argon2 from "argon2"
import { ErrorException,ErrorCode } from '../../../../utils/errors/';
export class NewPasswordUser {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  public async execute(password: string, token: string) {

    // A enlever une fois le middleware executé
    const existUserResetToken =  await this.userRepo.existUserResetToken(token)
    if (!existUserResetToken) {
        throw new ErrorException(ErrorCode.Unauthorized);
    }

    const hashPassword = await argon2.hash(password);
    console.log("hashed password", hashPassword);

    password = hashPassword;

    const result = await this.userRepo.newPassword(password, token);
    return result;
  }
}
