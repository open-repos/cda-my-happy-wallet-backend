import { UserRepo } from "../../userRepo";
import { ErrorException } from "../../../../utils/errors/errorException.error";
import { ErrorCode } from "./../../../../utils/errors/errorCode.error";
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
    const result = await this.userRepo.resetPassword(email, resetToken);

    if (!result.success) {
      throw new ErrorException(ErrorCode.PrismaError);
    }

    const verificationLink = `http://localhost:4200/v1/users/reset-password/${resetToken}`;
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
    return {
      success: true,
      message: `Email to reset password was sent to ${emailToSend}`,
    };
  }
}
