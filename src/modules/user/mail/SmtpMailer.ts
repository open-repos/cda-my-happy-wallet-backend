import nodemailer from "nodemailer";
import {
  EMAIL_SENDER,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
} from "../../../config/config";
import { ErrorCode, ErrorException } from "../../../utils/errors";
import { IMailer } from "./Mailer.interface";

interface MailTransport {
  sendMail(options: {
    from: string;
    html: string;
    subject: string;
    to: string;
  }): Promise<unknown>;
}

export class SmtpMailer implements IMailer {
  private readonly transport: MailTransport;

  constructor(
    transport: MailTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
    })
  ) {
    this.transport = transport;
  }

  public async sendMail(
    email: string,
    subject: string,
    text: string
  ): Promise<boolean> {
    try {
      await this.transport.sendMail({
        from: EMAIL_SENDER || "no-reply@myhappywallet.local",
        html: text,
        subject,
        to: email,
      });
      return true;
    } catch (_) {
      throw new ErrorException(ErrorCode.SendEmaillError);
    }
  }
}
