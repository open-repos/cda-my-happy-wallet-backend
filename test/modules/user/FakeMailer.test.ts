import assert from "assert";
import { FakeMailer } from "../../fakes/FakeMailer";

async function runFakeMailerTests() {
  const successfulMailer = new FakeMailer();

  const success = await successfulMailer.sendMail(
    "user@example.com",
    "Subject",
    "<p>Hello</p>"
  );

  assert.strictEqual(success, true);
  assert.deepStrictEqual(successfulMailer.sentMails, [
    {
      email: "user@example.com",
      subject: "Subject",
      text: "<p>Hello</p>",
    },
  ]);

  const failingMailer = new FakeMailer(false);
  const failure = await failingMailer.sendMail(
    "user@example.com",
    "Subject",
    "<p>Hello</p>"
  );

  assert.strictEqual(failure, false);
  assert.strictEqual(failingMailer.sentMails.length, 1);
}

runFakeMailerTests();
