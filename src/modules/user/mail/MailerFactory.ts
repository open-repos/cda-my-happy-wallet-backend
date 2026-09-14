import { MAILER_DRIVER } from "../../../config/config";
import { IMailer } from "./Mailer.interface";
import { SendGridMailer } from "./SendGridMailer";
import { SmtpMailer } from "./SmtpMailer";

export const createMailer = (): IMailer => {
  if (MAILER_DRIVER === "smtp") {
    return new SmtpMailer();
  }

  if (MAILER_DRIVER === "sendgrid") {
    return new SendGridMailer();
  }

  throw new Error(`Unsupported mailer driver: ${MAILER_DRIVER}`);
};
