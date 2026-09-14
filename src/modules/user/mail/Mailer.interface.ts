export interface IMailer {
  sendMail(email: string, subject: string, text: string): Promise<boolean>;
}
