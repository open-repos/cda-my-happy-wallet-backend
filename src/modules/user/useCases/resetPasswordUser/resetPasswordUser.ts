import { FRONTEND_URL } from "./../../../../config/config";
import { IUserRepository } from "../../userRepository.interface";
import { ErrorException, ErrorCode } from "../../../../utils/errors/";
import { Result, ResultCode } from "./../../../../utils/results/";
// import { emailUserProps } from "../../../../utils/validators/email.validator";
import crypto from "crypto";
// import { confirmRegistrationUserController } from "../confirmRegistrationUser";

export class ResetPasswordUser {
  private userRepo: IUserRepository;

  constructor(userRepo: IUserRepository) {
    this.userRepo = userRepo;
  }

  public async execute(email: string) {
    const exist = await this.userRepo.exists(email);
    console.log("exists user?", exist);

    if (!exist) {
      throw new ErrorException(ErrorCode.EmailNotFound);
    }
    const resetToken: string = crypto.randomBytes(64).toString("hex");
    console.log("resetToken", resetToken);

    const now = new Date();
    // const resetTokenExpiration = await this.addHoursToDate(now, 1);
    const resetTokenExpiration = await this.addMinToDate(now, 15);
    console.log("resetTokenExpiration", resetTokenExpiration);

    await this.userRepo.resetPassword(
      email,
      resetToken,
      resetTokenExpiration
    );
    const result = await new Result(
      ResultCode.Created,
      `ResetToken successfully added`
    ).response_post();

    if (!result.success) {
      throw new ErrorException(ErrorCode.PrismaError);
    }
    const verificationLink = `${FRONTEND_URL}/new-password?resetToken=${resetToken}`;

    const emailToSend: string = email;
    const subject: string = "Renouvellement de mot de passe sur MyHappyWallet";
    const message: string = `Salut ! 
      <br/>
      Vous souhaitez modifier votre mot de passe ?
      <br/><br/>
      Si vous êtes à l'origine de cette demande, cliquez sur le lien suivant pour modifier le mot de passe: 
      <a href="${verificationLink}">Lien de renouvellement de mot de passe</a> (expire le ${resetTokenExpiration.toLocaleDateString("fr-FR",{ month: 'long', day: 'numeric' ,hour:"numeric",minute:"numeric", second:"numeric"})})
      <br/><br/>
      Je vous souhaite une bonne journée!`;

    const isEmailSent = await this.userRepo.sendMail(
      emailToSend,
      subject,
      message
    );

    if (!isEmailSent) {
      throw new ErrorException(ErrorCode.SendEmaillError);
    }
    const resp = await new Result(
      ResultCode.Read,
      "",
      `Email to reset password was sent to ${emailToSend}`
    ).response_post();
    return resp;
    // return {
    //   success: true,
    //   message: `Email to reset password was sent to ${emailToSend}`,
    // };
  }

  public async addHoursToDate(objDate: Date, intHours: number): Promise<Date> {
    const numberOfMlSeconds = objDate.getTime();
    const addMlSeconds = intHours * 60 * 60 * 1000;
    const newDateObj = new Date(numberOfMlSeconds + addMlSeconds);

    return newDateObj;
  }

  public async addMinToDate(objDate: Date, intMin: number): Promise<Date> {
    const numberOfMlSeconds = objDate.getTime();
    const addMlSeconds = intMin * 60 * 1000;
    const newDateObj = new Date(numberOfMlSeconds + addMlSeconds);

    return newDateObj;
  }
}
