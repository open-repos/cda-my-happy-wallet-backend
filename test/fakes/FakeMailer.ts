import { IMailer } from "../../src/modules/user/mail/Mailer.interface";

export type SentMail = {
  email: string;
  subject: string;
  text: string;
};

export class FakeMailer implements IMailer {
  public sentMails: SentMail[] = [];

  constructor(private shouldSend: boolean = true) {}

  public async sendMail(
    email: string,
    subject: string,
    text: string
  ): Promise<boolean> {
    this.sentMails.push({ email, subject, text });
    return this.shouldSend;
  }
}
