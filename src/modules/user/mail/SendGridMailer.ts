import sgMail from "@sendgrid/mail";
import { NODE_ENV, SENDGRID_API_KEY, EMAIL_SENDER } from "../../../config/config";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { IMailer } from "./Mailer.interface";

export class SendGridMailer implements IMailer {
  public async sendMail(
    email: string,
    subject: string,
    text: string
  ): Promise<boolean> {
    console.log("await sending email confirmation");
    sgMail.setApiKey(SENDGRID_API_KEY as string);
    let trackingFalse: boolean = false;
    if (NODE_ENV === "production") {
      trackingFalse = true;
    } else {
      trackingFalse = false;
    }
    const msg = {
      to: email, // Change to your recipient
      from: EMAIL_SENDER as string, // Change to your verified sender
      subject: subject,
      // text:text,
      html: text,
      trackingSettings: {
        clickTracking: {
          enable: trackingFalse,
          enableText: trackingFalse,
        },
        openTracking: {
          enable: trackingFalse,
        },
      },
    };

    const isEmailSent: Promise<boolean> = sgMail
      .send(msg)
      .then(async (response) => {
        console.log("RESPONSE MAIL", response[0].statusCode);
        console.log("RESPONSE HEADER", response[0].headers);
        if (response[0].statusCode == 202) {
          return true;
        } else {
          return false;
        }
      })
      .catch((error) => {
        console.log("ERROR EMAIL", error);
        throw new ErrorException(ErrorCode.SendEmaillError);
      });
    console.log("OUTSIDE THEN CATCH", isEmailSent);
    return isEmailSent;
  }
}
