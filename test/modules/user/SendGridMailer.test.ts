import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { AddressInfo } from "node:net";

export async function runSendGridMailerTests(): Promise<void> {
  // All credentials are synthetic and all HTTP requests stay on loopback.
  Object.assign(process.env, {
    NODE_ENV: "test",
    ACCESS_TOKEN: "test-access-token-secret-at-least-32-characters",
    REFRESH_TOKEN: "test-refresh-token-secret-at-least-32-characters",
    REGISTER_TOKEN: "test-register-token-secret-at-least-32-characters",
    SENDGRID_API_KEY: "SG.synthetic-local-tests-only",
    EMAIL_SENDER: "no-reply@myhappywallet.local",
  });
  const config = require("../../../src/config/config");
  const {
    SendGridMailer,
  } = require("../../../src/modules/user/mail/SendGridMailer");
  const original = {
    NODE_ENV: config.NODE_ENV,
    SENDGRID_API_KEY: config.SENDGRID_API_KEY,
    EMAIL_SENDER: config.EMAIL_SENDER,
  };
  Object.assign(config, {
    NODE_ENV: "test",
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    EMAIL_SENDER: process.env.EMAIL_SENDER,
  });
  let status = 202;
  let delay = false;
  let redirectedRequests = 0;
  const received: {
    method?: string;
    url?: string;
    headers: http.IncomingHttpHeaders;
    body: unknown;
  }[] = [];
  const target = http.createServer((_request, response) => {
    redirectedRequests++;
    response.end();
  });
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      received.push({
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: JSON.parse(body),
      });
      if (delay) return; // The client must abort this hanging provider response.
      response.writeHead(status, {
        "Content-Type": "application/json",
        Location: `http://127.0.0.1:${
          (target.address() as AddressInfo).port
        }/capture`,
      });
      response.end('{"errors":[{"message":"private provider failure"}]}');
    });
  });
  const rejected = (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.name, "SendEmaillError");
    assert.equal(error.message, "Email was not sent");
    assert.equal(error.stack?.includes("private provider failure"), false);
    assert.equal(error.stack?.includes("SG.synthetic"), false);
    return true;
  };
  try {
    target.listen(0, "127.0.0.1");
    await once(target, "listening");
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const transport: typeof fetch = async (url, options) => {
      assert.equal(url, "https://api.sendgrid.com/v3/mail/send");
      assert.equal(options?.redirect, "manual");
      assert.ok(options?.signal instanceof AbortSignal);
      return fetch(
        `http://127.0.0.1:${
          (server.address() as AddressInfo).port
        }/v3/mail/send`,
        options
      );
    };
    const mailer = new SendGridMailer(transport, 2_000);
    const subject = 'Confirmation "été"';
    const html = '<p>Bonjour & "bienvenue"\n</p>';
    assert.equal(
      await mailer.sendMail("recipient@example.test", subject, html),
      true
    );
    assert.deepEqual(received[0], {
      method: "POST",
      url: "/v3/mail/send",
      headers: received[0].headers,
      body: {
        personalizations: [{ to: [{ email: "recipient@example.test" }] }],
        from: { email: "no-reply@myhappywallet.local" },
        subject,
        content: [{ type: "text/html", value: html }],
        tracking_settings: {
          click_tracking: { enable: false, enable_text: false },
          open_tracking: { enable: false },
        },
      },
    });
    assert.equal(
      received[0].headers.authorization,
      "Bearer SG.synthetic-local-tests-only"
    );
    assert.equal(received[0].headers["content-type"], "application/json");
    config.NODE_ENV = "production";
    assert.equal(
      await mailer.sendMail("recipient@example.test", subject, html),
      true
    );
    assert.deepEqual(
      (received[1].body as { tracking_settings: unknown }).tracking_settings,
      {
        click_tracking: { enable: true, enable_text: true },
        open_tracking: { enable: true },
      }
    );
    status = 200;
    assert.equal(
      await mailer.sendMail("recipient@example.test", subject, html),
      false
    );
    for (status of [302, 307, 400, 401, 429, 500]) {
      await assert.rejects(
        () => mailer.sendMail("recipient@example.test", subject, html),
        rejected
      );
    }
    assert.equal(
      redirectedRequests,
      0,
      "Never forward credentials to a redirect target"
    );
    const beforeMissingConfig = received.length;
    for (const field of ["SENDGRID_API_KEY", "EMAIL_SENDER"]) {
      const value = config[field];
      config[field] = " ";
      await assert.rejects(
        () => mailer.sendMail("recipient@example.test", subject, html),
        rejected
      );
      config[field] = value;
    }
    assert.equal(received.length, beforeMissingConfig);
    const disconnected = new SendGridMailer(async () => {
      throw new Error("private provider failure SG.synthetic");
    });
    await assert.rejects(
      () => disconnected.sendMail("recipient@example.test", subject, html),
      rejected
    );
    status = 202;
    delay = true;
    const impatient = new SendGridMailer(transport, 30);
    await assert.rejects(
      () => impatient.sendMail("recipient@example.test", subject, html),
      rejected
    );
    // A successful acknowledgement is retained even when releasing the stream fails.
    const cleanupFailure = new SendGridMailer(
      async () =>
        ({
          ok: true,
          status: 202,
          body: {
            cancel: async () => {
              throw new Error("cleanup failed");
            },
          },
        } as unknown as Response)
    );
    assert.equal(
      await cleanupFailure.sendMail("recipient@example.test", subject, html),
      true
    );
    console.log(
      "SendGrid native transport tests passed (payload, tracking, errors, redirects, timeout)"
    );
  } finally {
    Object.assign(config, original);
    for (const listener of [server, target]) {
      if (!listener.listening) continue;
      const closed = once(listener, "close");
      listener.closeAllConnections();
      listener.close();
      await closed;
    }
  }
}

if (require.main === module) {
  runSendGridMailerTests().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
