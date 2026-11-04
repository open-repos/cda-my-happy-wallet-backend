import assert from "assert";
import { createServer, Socket } from "net";
import {
  SmtpMailer,
  SmtpSettings,
  smtpTransportOptions,
} from "../../../src/modules/user/mail/SmtpMailer";
import { ErrorCode, ErrorException } from "../../../src/utils/errors";

const rejected = (error: ErrorException) =>
  error.name === ErrorCode.SendEmaillError;

const relay: SmtpSettings = {
  host: "smtp.example.test",
  port: 587,
  secure: false,
  requireTLS: true,
  user: "relay-user",
  password: "synthetic-smtp-password",
  sender: "no-reply@example.test",
  production: true,
};
const internalRelay: SmtpSettings = {
  host: "172.22.0.1",
  port: 25,
  secure: false,
  requireTLS: false,
  sender: "no-reply@example.test",
  production: true,
};

function assertTransportOptions() {
  const options = smtpTransportOptions(relay);
  assert.ok(options);
  assert.deepStrictEqual(options.auth, {
    user: "relay-user",
    pass: "synthetic-smtp-password",
  });
  assert.strictEqual(options.requireTLS, true);
  for (const timeout of [
    options.connectionTimeout,
    options.greetingTimeout,
    options.socketTimeout,
  ]) {
    assert.ok(timeout > 0 && timeout <= 10_000);
  }
  assert.strictEqual("tls" in options, false);
  assert.strictEqual("rejectUnauthorized" in options, false);

  const internal = smtpTransportOptions(internalRelay);
  assert.ok(internal);
  assert.strictEqual("auth" in internal, false);
  assert.strictEqual(internal.ignoreTLS, true);
  assert.strictEqual(options.ignoreTLS, false);
  assert.ok(
    smtpTransportOptions({
      ...internalRelay,
      returnPath: "bounces@example.test",
    })
  );
  assert.ok(smtpTransportOptions({ ...internalRelay, host: "127.0.0.1" }));
  assert.ok(
    smtpTransportOptions({ ...relay, secure: true, requireTLS: false })
  );
  assert.ok(
    smtpTransportOptions({
      ...internalRelay,
      host: "mailpit",
      production: false,
    })
  );

  for (const invalid of [
    { ...relay, password: undefined },
    { ...relay, password: "   " },
    { ...relay, user: undefined },
    { ...relay, requireTLS: false },
    { ...relay, host: " " },
    { ...relay, port: 0 },
    { ...relay, port: Number.NaN },
    { ...internalRelay, host: "smtp.example.test" },
    { ...internalRelay, host: "203.0.113.10" },
    { ...internalRelay, host: "172.32.0.1" },
    { ...internalRelay, host: "mailpit" },
    { ...internalRelay, user: "relay-user", password: "secret" },
    { ...internalRelay, returnPath: "Bounces <bounces@example.test>" },
  ]) {
    assert.strictEqual(smtpTransportOptions(invalid), null);
  }
}

async function assertMessages() {
  const sentMessages: unknown[] = [];
  const transport = {
    async sendMail(message: { to: string }) {
      sentMessages.push(message);
      return { accepted: [message.to] };
    },
  };
  const mailer = new SmtpMailer(transport);

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
      text: "Confirm account",
      to: "user@example.test",
    },
  ]);

  sentMessages.length = 0;
  await new SmtpMailer(transport, {
    ...internalRelay,
    returnPath: "bounces@example.test",
  }).sendMail("user@example.test", "Subject", "Body");
  assert.deepStrictEqual(sentMessages, [
    {
      envelope: { from: "bounces@example.test", to: "user@example.test" },
      from: "no-reply@example.test",
      html: "Body",
      subject: "Subject",
      text: "Body",
      to: "user@example.test",
    },
  ]);
}

async function assertConfigurationFailures() {
  const diagnostics: unknown[] = [];
  let sends = 0;
  const transport = {
    async sendMail() {
      sends += 1;
    },
  };
  await assert.rejects(
    () =>
      new SmtpMailer(
        transport,
        { ...internalRelay, sender: undefined },
        (diagnostic) => diagnostics.push(diagnostic)
      ).sendMail("user@example.test", "Subject", "Body"),
    rejected
  );
  await assert.rejects(
    () =>
      new SmtpMailer(undefined, { ...relay, requireTLS: false }, (diagnostic) =>
        diagnostics.push(diagnostic)
      ).sendMail("user@example.test", "Subject", "Body"),
    rejected
  );
  assert.strictEqual(sends, 0);
  assert.deepStrictEqual(diagnostics, [
    { provider: "smtp", category: "configuration" },
    { provider: "smtp", category: "configuration" },
  ]);
}

async function assertFailureClassification() {
  const sensitive = {
    message: "Can't send mail to user@example.test: synthetic-smtp-password",
    response: "550 5.1.1 <user@example.test> unknown Subject",
    rejected: ["user@example.test"],
    command: "RCPT TO",
  };
  const scenarios: Array<[Record<string, unknown>, Record<string, unknown>]> = [
    [
      { code: "EAUTH", responseCode: 535 },
      { category: "authentication", code: "EAUTH", responseCode: 535 },
    ],
    [{ code: "EDNS" }, { category: "dns", code: "EDNS" }],
    [
      { code: "ESOCKET", originalCode: "ENOTFOUND" },
      { category: "dns", code: "ESOCKET", networkCode: "ENOTFOUND" },
    ],
    [
      { code: "ESOCKET", originalCode: "ECONNREFUSED" },
      { category: "network", code: "ESOCKET", networkCode: "ECONNREFUSED" },
    ],
    [{ code: "ETIMEDOUT" }, { category: "timeout", code: "ETIMEDOUT" }],
    [{ code: "ETLS" }, { category: "tls", code: "ETLS" }],
    [
      { code: "ESOCKET", originalCode: "CERT_HAS_EXPIRED" },
      { category: "tls", code: "ESOCKET", networkCode: "CERT_HAS_EXPIRED" },
    ],
    [
      { code: "ESOCKET", originalCode: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" },
      {
        category: "tls",
        code: "ESOCKET",
        networkCode: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      },
    ],
    [
      { code: "EENVELOPE", responseCode: 451 },
      {
        category: "transient_rejection",
        code: "EENVELOPE",
        responseCode: 451,
      },
    ],
    [
      { code: "EENVELOPE", responseCode: 550 },
      {
        category: "permanent_rejection",
        code: "EENVELOPE",
        responseCode: 550,
      },
    ],
    [{ code: "not a safe code" }, { category: "network" }],
  ];

  const history: unknown[] = [];
  for (const [failure, expected] of scenarios) {
    const diagnostics: unknown[] = [];
    await assert.rejects(
      () =>
        new SmtpMailer(
          {
            async sendMail() {
              throw Object.assign(new Error(sensitive.message), {
                ...sensitive,
                ...failure,
              });
            },
          },
          relay,
          (diagnostic) => diagnostics.push(diagnostic)
        ).sendMail("user@example.test", "Subject", "Body"),
      rejected
    );
    assert.deepStrictEqual(diagnostics, [{ provider: "smtp", ...expected }]);
    history.push(...diagnostics);
  }

  const serialized = JSON.stringify(history);
  for (const value of [
    "user@example.test",
    "synthetic-smtp-password",
    "Subject",
    "Body",
    "unknown",
    "RCPT",
  ]) {
    assert.strictEqual(serialized.includes(value), false);
  }
}

async function assertRealTransportFailure() {
  const diagnostics: Array<Record<string, unknown>> = [];
  await assert.rejects(
    () =>
      new SmtpMailer(
        undefined,
        { ...internalRelay, host: "127.0.0.1", port: 1 },
        (diagnostic) => diagnostics.push(diagnostic)
      ).sendMail("user@example.test", "Subject", "Body"),
    rejected
  );
  assert.deepStrictEqual(diagnostics, [
    {
      provider: "smtp",
      category: "network",
      code: "ESOCKET",
      networkCode: "ECONNREFUSED",
    },
  ]);
}

/** Runs a real Nodemailer exchange against a scripted local SMTP server. */
async function exchange(
  respond: (socket: Socket, chunk: string) => void,
  settings: Partial<SmtpSettings> = {},
  greet = true
) {
  const commands: string[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => undefined);
    socket.on("data", (data) => {
      commands.push(data.toString("latin1"));
      respond(socket, data.toString("latin1"));
    });
    if (greet) socket.write("220 test ESMTP\r\n");
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve())
  );
  const { port } = server.address() as { port: number };
  const diagnostics: Array<Record<string, unknown>> = [];
  const outcome = await new SmtpMailer(
    undefined,
    { ...internalRelay, host: "127.0.0.1", port, timeoutMs: 300, ...settings },
    (diagnostic) => diagnostics.push(diagnostic)
  )
    .sendMail("user@example.test", "Subject", "Body")
    .catch((error: ErrorException) => error.name);
  sockets.forEach((socket) => socket.destroy());
  await new Promise((resolve) => server.close(resolve));
  return { commands, diagnostics, outcome };
}

const smtpDialog =
  (recipientReply: string) => (socket: Socket, chunk: string) => {
    if (/^EHLO/i.test(chunk)) socket.write("250-test\r\n250 STARTTLS\r\n");
    else if (/^RCPT/i.test(chunk)) socket.write(`${recipientReply}\r\n`);
    else if (/^DATA/i.test(chunk)) socket.write("354 go\r\n");
    else if (/^QUIT/i.test(chunk)) socket.write("221 bye\r\n");
    else socket.write("250 ok\r\n");
  };

async function assertRealExchanges() {
  const delivered = await exchange(smtpDialog("250 ok"), {
    returnPath: "bounces@example.test",
  });
  assert.strictEqual(delivered.outcome, true);
  assert.deepStrictEqual(delivered.diagnostics, []);
  assert.strictEqual(
    delivered.commands.some((command) => /^STARTTLS/i.test(command)),
    false
  );
  assert.ok(
    delivered.commands.some((command) =>
      /^MAIL FROM:<bounces@example\.test>/i.test(command)
    )
  );
  const data = delivered.commands.join("");
  assert.match(data, /Content-Type: multipart\/alternative/i);
  assert.match(data, /Content-Type: text\/plain/i);
  assert.match(data, /Content-Type: text\/html/i);

  for (const [reply, category, responseCode] of [
    ["451 try later", "transient_rejection", 451],
    ["550 unknown", "permanent_rejection", 550],
  ] as const) {
    const refused = await exchange(smtpDialog(reply));
    assert.strictEqual(refused.outcome, ErrorCode.SendEmaillError);
    assert.strictEqual(refused.diagnostics[0].category, category);
    assert.strictEqual(refused.diagnostics[0].responseCode, responseCode);
  }

  const silent = await exchange(() => undefined, {}, false);
  assert.strictEqual(silent.outcome, ErrorCode.SendEmaillError);
  assert.strictEqual(silent.diagnostics[0].category, "timeout");

  const clearTextAfterStartTls = await exchange(
    (socket, chunk) => {
      if (/^EHLO/i.test(chunk)) socket.write("250-test\r\n250 STARTTLS\r\n");
      else if (/^STARTTLS/i.test(chunk)) socket.write("220 go\r\n");
      else socket.write("250 not tls\r\n");
    },
    { requireTLS: true }
  );
  assert.strictEqual(clearTextAfterStartTls.outcome, ErrorCode.SendEmaillError);
  assert.strictEqual(clearTextAfterStartTls.diagnostics[0].category, "tls");

  const noStartTls = await exchange(
    (socket, chunk) =>
      socket.write(/^EHLO/i.test(chunk) ? "250 test\r\n" : "250 ok\r\n"),
    { requireTLS: true }
  );
  assert.strictEqual(noStartTls.outcome, ErrorCode.SendEmaillError);
  assert.strictEqual(
    noStartTls.commands.some((command) => /^MAIL FROM/i.test(command)),
    false
  );
}

async function runSmtpMailerTests() {
  assertTransportOptions();
  await assertMessages();
  await assertConfigurationFailures();
  await assertFailureClassification();
  await assertRealTransportFailure();
  await assertRealExchanges();
}

runSmtpMailerTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
