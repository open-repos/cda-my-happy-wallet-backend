import assert from "assert";
import { SmtpMailer } from "../../../src/modules/user/mail/SmtpMailer";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

async function runSmtpMailerTests() {
  const sentMessages: unknown[] = [];
  const mailer = new SmtpMailer({
    async sendMail(message) {
      sentMessages.push(message);
      return { accepted: [message.to] };
    },
  });

  const sent = await mailer.sendMail(
    "user@example.test",
    "Confirmation",
    "<p>Confirm account</p>"
  );

  assert.strictEqual(sent, true);
  assert.deepStrictEqual(sentMessages, [
    {
      from: "no-reply@myhappywallet.local",
      html: "<p>Confirm account</p>",
      subject: "Confirmation",
      to: "user@example.test",
    },
  ]);

  const failingMailer = new SmtpMailer({
    async sendMail() {
      throw new Error("SMTP unavailable");
    },
  });

  await assert.rejects(
    () => failingMailer.sendMail("user@example.test", "Subject", "Body"),
    (error: ErrorException) => error.name === ErrorCode.SendEmaillError
  );
}

runSmtpMailerTests();
