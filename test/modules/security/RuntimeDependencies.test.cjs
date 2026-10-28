const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const { createRequire } = require("node:module");
const os = require("node:os");
const path = require("node:path");
require("ts-node/register");

// All transport calls below are forced to loopback with synthetic credentials.
Object.assign(process.env, {
  NODE_ENV: "test",
  ACCESS_TOKEN: "test-access-token-secret-at-least-32-characters",
  REFRESH_TOKEN: "test-refresh-token-secret-at-least-32-characters",
  REGISTER_TOKEN: "test-register-token-secret-at-least-32-characters",
  SENDGRID_API_KEY: "SG.synthetic-local-tests-only",
  EMAIL_SENDER: "no-reply@myhappywallet.local",
});
const root = path.resolve(__dirname, "../../..");

async function prismaCompatibility(directory) {
  const { deepmerge } = createRequire(require.resolve("@prisma/config"))(
    "deepmerge-ts"
  );
  const left = { name: "left" },
    right = { enabled: true };
  left.self = left;
  right.self = right;
  const merged = deepmerge(left, right);
  assert.equal(merged.self, merged);
  assert.equal(merged.name, "left");
  assert.equal(merged.enabled, true);
  const configFile = path.join(directory, "prisma.config.cjs");
  const schema = path.join(root, "src/database/schema.prisma");
  const migrations = path.join(root, "src/database/migrations");
  await fs.writeFile(
    configFile,
    `module.exports = ${JSON.stringify({
      schema,
      migrations: { path: migrations },
    })};\n`
  );
  const loaded = await require("@prisma/config").loadConfigFromFile({
    configFile,
    configRoot: directory,
  });
  assert.ifError(loaded.error);
  assert.equal(loaded.config.schema, schema);
  assert.equal(loaded.config.migrations.path, migrations);
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/prisma/build/index.js"),
      "validate",
      "--config",
      configFile,
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        DATABASE_URL: "mysql://test:test@127.0.0.1:3306/myhappywallet_test",
      },
    }
  );
  assert.equal(
    result.status,
    0,
    "Prisma validate must accept the loaded configuration"
  );
  assert.match(result.stdout, /is valid/i);
}

async function watchCompatibility(directory) {
  const dependency = path.join(directory, "watch-value.cjs");
  const entry = path.join(directory, "watch-main.cjs");
  await fs.writeFile(dependency, 'module.exports = "watch_first";\n');
  await fs.writeFile(
    entry,
    'console.log(require("./watch-value.cjs")); setInterval(() => {}, 1000);\n'
  );
  const child = spawn(process.execPath, ["--watch", entry], {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = once(child, "close");
  let output = "",
    pending;
  child.stdout.on("data", (chunk) => {
    output += chunk;
    pending?.();
  });
  child.stderr.resume();
  const waitFor = async (marker) => {
    if (output.includes(marker)) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending = undefined;
        reject(new Error("Native watch did not restart"));
      }, 10_000);
      pending = () => {
        if (output.includes(marker)) {
          clearTimeout(timeout);
          pending = undefined;
          resolve();
        }
      };
    });
  };
  try {
    await waitFor("watch_first");
    await fs.writeFile(dependency, 'module.exports = "watch_second";\n');
    await waitFor("watch_second");
  } finally {
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        child.kill();
      }
    }
    await closed;
  }
}

async function smtpCompatibility() {
  const { SmtpMailer } = require("../../../src/modules/user/mail/SmtpMailer");
  const sockets = new Set(),
    messages = [];
  let rejectRecipient = false;
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.setTimeout(5_000, () => socket.destroy());
    socket.write("220 localhost synthetic SMTP\r\n");
    let buffer = "",
      receiving = false;
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.length) {
        if (receiving) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end < 0) return;
          messages.push(buffer.slice(0, end));
          buffer = buffer.slice(end + 5);
          receiving = false;
          socket.write("250 accepted\r\n");
          continue;
        }
        const end = buffer.indexOf("\r\n");
        if (end < 0) return;
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (/^(EHLO|HELO)/.test(line)) socket.write("250 localhost\r\n");
        else if (/^RCPT TO/.test(line) && rejectRecipient)
          socket.write("550 synthetic private failure\r\n");
        else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)/.test(line))
          socket.write("250 OK\r\n");
        else if (line === "DATA") {
          receiving = true;
          socket.write("354 send data\r\n");
        } else if (line === "QUIT") socket.end("221 bye\r\n");
        else socket.write("500 unsupported command\r\n");
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const transport = require("nodemailer").createTransport({
    host: "127.0.0.1",
    port: server.address().port,
    secure: false,
    connectionTimeout: 2_000,
    socketTimeout: 3_000,
  });
  try {
    const mailer = new SmtpMailer(transport);
    assert.equal(
      await mailer.sendMail(
        "recipient@example.test",
        "Synthetic confirmation",
        "<p>Local test only</p>"
      ),
      true
    );
    assert.equal(messages.length, 1);
    assert.match(messages[0], /To: recipient@example.test/);
    assert.match(messages[0], /Subject: Synthetic confirmation/);
    assert.match(messages[0], /<p>Local test only<\/p>/);
    rejectRecipient = true;
    await assert.rejects(
      () => mailer.sendMail("recipient@example.test", "Rejected", "Synthetic"),
      (error) =>
        error.name === "SendEmaillError" &&
        error.message === "Email was not sent"
    );
    assert.equal(messages.length, 1);
  } finally {
    transport.close();
    const closed = once(server, "close");
    for (const socket of sockets) socket.destroy();
    server.close();
    await closed;
  }
}

async function sendGridCompatibility() {
  const { runSendGridMailerTests } = require("../user/SendGridMailer.test");
  await runSendGridMailerTests();
}

async function run() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mhw-runtime-dependencies-")
  );
  try {
    await prismaCompatibility(directory);
    await watchCompatibility(directory);
    await smtpCompatibility();
    await sendGridCompatibility();
    console.log("Runtime dependency compatibility tests passed");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
