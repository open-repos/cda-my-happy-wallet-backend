import { PORT, APP_BASE_URL, NODE_ENV } from "./../../../../config/config";
import { UserRepo } from "../../userRepo";
import { ErrorException, ErrorCode } from "../../../../utils/errors/";
import { Result, ResultCode } from "./../../../../utils/results/";
// import { emailUserProps } from "../../../../utils/validators/email.validator";
import crypto from "crypto";
// import { confirmRegistrationUserController } from "../confirmRegistrationUser";

export class ResetPasswordUser {
  private userRepo: UserRepo;

  constructor(userRepo: UserRepo) {
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
    const resetTokenExpiration = await this.addHoursToDate(now, 1);
    console.log("resetTokenExpiration", resetTokenExpiration);

    const result = await this.userRepo.resetPassword(
      email,
      resetToken,
      resetTokenExpiration
    );

    if (!result.success) {
      throw new ErrorException(ErrorCode.PrismaError);
    }
    let verificationLink = "";
    if (NODE_ENV == "production") {
      verificationLink = `https://api.myhappywallet.andriacapai.com${APP_BASE_URL}/users/reset-password/${resetToken}`;
    } else {
      verificationLink = `http://localhost:${PORT}${APP_BASE_URL}/users/reset-password/${resetToken}`;
    }

    const emailToSend: string = "andria.capai@gmail.com"; // user.email
    const subject: string = "Renouvellement de mot de passe sur MyHappyWallet";
    const message: string = `Salut ! 
      <br/>
      Vous souhaitez modifier votre mot de passe ?
      <br/><br/>
      Si vous êtes à l'origine de cette demande, cliquez sur le lien suivant pour modifier le mot de passe: 
      <a href="${verificationLink}">Lien de renouvellement de mot de passe</a>
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
}
