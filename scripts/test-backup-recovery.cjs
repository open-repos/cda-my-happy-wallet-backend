#!/usr/bin/env node
// Disposable rehearsal only. This is deliberately not a production backup tool.
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function run(label, command, args, input) {
  const result = spawnSync(command, args, {
    input,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 90_000,
  });
  if (result.error || result.status !== 0) {
    // Do not publish SQL, subprocess stderr, configuration or dump contents.
    const error = new Error(label);
    error.mysqlCode = /ERROR (\d{4})/.exec(
      result.stderr?.toString() ?? ""
    )?.[1];
    throw error;
  }
  return result.stdout;
}

function demand(condition, label) {
  if (!condition) throw new Error(label);
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function archiveRoundTrip(directory, plaintext) {
  const key = path.join(directory, "archive.pass");
  const wrongKey = path.join(directory, "wrong.pass");
  const archive = path.join(directory, "mysql.sql.gz.enc");
  for (const name of [key, wrongKey]) {
    fs.writeFileSync(name, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  const options = ["-aes-256-cbc", "-pbkdf2", "-iter", "200000"];
  const compressed = run("gzip_compress", "gzip", ["-9c"], plaintext);
  run(
    "encrypt",
    "openssl",
    ["enc", ...options, "-salt", "-pass", `file:${key}`, "-out", archive],
    compressed
  );
  fs.chmodSync(archive, 0o600);
  const checksum = `${digest(fs.readFileSync(archive))}  mysql.sql.gz.enc\n`;
  fs.writeFileSync(`${archive}.sha256`, checksum, { mode: 0o600 });

  function verifyChecksum() {
    const expected = fs.readFileSync(`${archive}.sha256`, "utf8").split(" ")[0];
    demand(digest(fs.readFileSync(archive)) === expected, "archive_checksum");
  }
  function decode(passFile) {
    verifyChecksum();
    const zipped = run("decrypt", "openssl", [
      "enc",
      "-d",
      ...options,
      "-pass",
      `file:${passFile}`,
      "-in",
      archive,
    ]);
    run("gzip_integrity", "gzip", ["--test"], zipped);
    return run("gzip_decompress", "gzip", ["-dc"], zipped);
  }

  verifyChecksum();
  assert.deepEqual(decode(key), plaintext, "encrypted_round_trip");
  assert.throws(() => decode(wrongKey), undefined, "wrong_key_refused");
  const goodArchive = fs.readFileSync(archive);
  fs.appendFileSync(archive, "corruption");
  assert.throws(
    () => decode(key),
    /archive_checksum/,
    "corruption_refused_before_import"
  );
  fs.writeFileSync(archive, goodArchive, { mode: 0o600 });
  return decode(key);
}

function guard() {
  demand(process.env.NODE_ENV === "test", "guard_test_environment");
  const container = process.env.BACKUP_DRILL_MYSQL_CONTAINER;
  demand(
    typeof container === "string" &&
      /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(container),
    "guard_container"
  );
  let url;
  try {
    url = new URL(process.env.DATABASE_URL);
  } catch {
    throw new Error("guard_database_url");
  }
  demand(
    url.protocol === "mysql:" &&
      url.hostname === "my-happy-wallet-mysql-test" &&
      url.pathname === "/myhappywallet_test",
    "guard_database_url"
  );
  const inspect = JSON.parse(
    run("inspect_container", "docker", ["inspect", container]).toString()
  );
  demand(
    inspect.length === 1 && inspect[0].State.Running,
    "guard_running_container"
  );
  const configuration = inspect[0].Config;
  demand(configuration.Image === "mysql:8.0", "guard_mysql_image");
  demand(
    configuration.Env.includes("MYSQL_DATABASE=myhappywallet_test") &&
      configuration.Env.includes("MYSQL_ROOT_PASSWORD=test-root-password"),
    "guard_disposable_configuration"
  );
  return container;
}

function rehearse(container, directory) {
  const created = new Set();
  const id =
    new Date().toISOString().replace(/\D/g, "").slice(0, 14) +
    "_" +
    randomBytes(3).readUIntBE(0, 3);
  const source = `myhappywallet_test_drill_${id}_source`;
  const restored = `myhappywallet_test_drill_${id}_restored`;
  const connection = [
    "exec",
    "--interactive",
    "--env",
    "MYSQL_PWD=test-root-password",
    container,
  ];
  const mysql = (database, statement) =>
    run(
      "mysql_query",
      "docker",
      [
        ...connection,
        "mysql",
        "-uroot",
        "--batch",
        "--skip-column-names",
        database,
      ],
      statement
    )
      .toString()
      .trim();
  const dump = (database, dataOnly = false) =>
    run("mysql_dump", "docker", [
      ...connection,
      "mysqldump",
      "-uroot",
      "--single-transaction",
      "--quick",
      "--triggers",
      "--events",
      "--hex-blob",
      "--set-gtid-purged=OFF",
      "--no-tablespaces",
      "--skip-comments",
      "--order-by-primary",
      ...(dataOnly
        ? [
            "--no-create-info",
            "--skip-add-locks",
            "--skip-disable-keys",
            "--skip-extended-insert",
            "--compact",
          ]
        : []),
      database,
    ]);
  function create(database) {
    demand(
      /^myhappywallet_test_drill_[0-9]{14}_[0-9]+_(source|restored)$/.test(
        database
      ),
      "guard_created_database"
    );
    mysql(
      "myhappywallet_test",
      `CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    created.add(database);
  }
  function importDump(database, buffer) {
    demand(created.has(database), "guard_import_target");
    run(
      "mysql_import",
      "docker",
      [...connection, "mysql", "-uroot", database],
      buffer
    );
  }
  const invalidate = (database) => {
    demand(created.has(database), "guard_invalidation_target");
    return mysql(
      database,
      "DELETE FROM RefreshSession; UPDATE Utilisateur SET resetToken=NULL, resetTokenExpiration=NULL;"
    );
  };
  const noSessions = (database) =>
    mysql(
      database,
      "SELECT COUNT(*) FROM RefreshSession; SELECT COUNT(*) FROM Utilisateur WHERE resetToken IS NOT NULL OR resetTokenExpiration IS NOT NULL;"
    );
  const tables = (database) =>
    mysql(
      database,
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE();"
    );
  const migrations = (database) =>
    mysql(
      database,
      "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;"
    );
  const original = digest(dump("myhappywallet_test", true));
  let tableCount;

  try {
    demand(migrations("myhappywallet_test") === "0", "source_migrations");
    create(source);
    importDump(source, dump("myhappywallet_test"));
    mysql(
      source,
      `
      INSERT INTO Utilisateur (firstname,lastname,password,email,verified,resetToken,resetTokenExpiration)
      VALUES ('Backup','A','synthetic-not-a-login-hash','backup-a@example.test',true,'synthetic-reset-a','2030-01-01');
      SET @a=LAST_INSERT_ID();
      INSERT INTO Utilisateur (firstname,lastname,password,email,verified,resetToken,resetTokenExpiration)
      VALUES ('Backup','B','synthetic-not-a-login-hash','backup-b@example.test',true,'synthetic-reset-b','2030-01-01');
      SET @b=LAST_INSERT_ID();
      INSERT INTO OperationCategory (name,color,icon,userId,updatedAt) VALUES ('Backup A','#123456','regular:heart',@a,NOW());
      SET @ca=LAST_INSERT_ID();
      INSERT INTO OperationCategory (name,color,icon,userId,updatedAt) VALUES ('Backup B','#654321',NULL,@b,NOW());
      SET @cb=LAST_INSERT_ID();
      INSERT INTO OneOffOperationRecord (title,amount,currency,type,operationDate,userId,categoryId,updatedAt)
      VALUES ('Backup A',1234.56,'EUR','DEPENSE','2026-02-28',@a,@ca,NOW()),('Backup B',20.10,'EUR','ENTREE','2026-03-01',@b,@cb,NOW());
      INSERT INTO RefreshSession (id,tokenHash,expiresAt,userId,updatedAt)
      VALUES ('${randomUUID()}',REPEAT('a',64),'2030-01-01',@a,NOW()),('${randomUUID()}',REPEAT('b',64),'2030-01-01',@b,NOW());
    `
    );
    const archived = archiveRoundTrip(directory, dump(source));
    create(restored);
    importDump(restored, archived);
    demand(tables(source) === tables(restored), "table_count");
    demand(migrations(restored) === "0", "restored_migrations");
    demand(
      digest(dump(source, true)) === digest(dump(restored, true)),
      "all_rows_identical"
    );
    const ownership = (database) =>
      mysql(
        database,
        `
      SELECT CONCAT(u.email,':',o.amount,':',o.currency,':',o.operationDate,':',c.icon IS NULL)
      FROM OneOffOperationRecord o JOIN Utilisateur u ON u.id=o.userId
      JOIN OperationCategory c ON c.id=o.categoryId AND c.userId=o.userId
      WHERE u.email IN ('backup-a@example.test','backup-b@example.test') ORDER BY u.email;
    `
      );
    const expected =
      "backup-a@example.test:1234.56:EUR:2026-02-28:0\nbackup-b@example.test:20.10:EUR:2026-03-01:1";
    demand(ownership(restored) === expected, "ownership_dates_money_icons");
    assert.throws(
      () =>
        mysql(
          restored,
          `
      INSERT INTO OneOffOperationRecord (title,amount,currency,type,operationDate,userId,categoryId,updatedAt)
      SELECT 'Forbidden',1.00,'EUR','DEPENSE','2026-02-28',a.id,c.id,NOW()
      FROM Utilisateur a JOIN Utilisateur b ON b.email='backup-b@example.test'
      JOIN OperationCategory c ON c.userId=b.id WHERE a.email='backup-a@example.test';
    `
        ),
      (error) => error.mysqlCode === "1452",
      "foreign_owner_constraint"
    );
    demand(ownership(restored) === expected, "foreign_owner_no_mutation");
    invalidate(restored);
    demand(noSessions(restored) === "0\n0", "restored_sessions_invalidated");

    // The selector models a switch before reopening writes; no app is deployed.
    let active = restored;
    demand(ownership(active) === expected, "candidate_read");
    invalidate(source); // A rollback must not revive the old sessions either.
    active = source;
    demand(
      ownership(active) === expected && noSessions(active) === "0\n0",
      "rollback_read_and_sessions"
    );
    demand(
      original === digest(dump("myhappywallet_test", true)),
      "original_database_unchanged"
    );
    tableCount = tables(restored);
  } finally {
    let cleanupFailed = false;
    for (const database of [...created].reverse()) {
      try {
        mysql("myhappywallet_test", `DROP DATABASE \`${database}\`;`);
        demand(
          mysql(
            "myhappywallet_test",
            `SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${database}';`
          ) === "0",
          "cleanup_database"
        );
      } catch {
        cleanupFailed = true;
      }
    }
    demand(!cleanupFailed, "cleanup_database");
  }
  console.log(
    `backup_drill_passed tables=${tableCount} migrations_failed=0 archive=verified corruption=refused sessions=invalidated rollback=simulated`
  );
}

let directory;
try {
  demand(process.env.NODE_ENV === "test", "guard_test_environment");
  const args = process.argv.slice(2);
  demand(
    args.length === 0 || (args.length === 1 && args[0] === "--crypto-only"),
    "guard_arguments"
  );
  const container = args.length === 0 ? guard() : null;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "mhw-backup-drill-"));
  fs.chmodSync(directory, 0o700);
  if (container) rehearse(container, directory);
  else {
    archiveRoundTrip(
      directory,
      Buffer.from("-- Synthetic fixture only\nSELECT 1234.56;\n")
    );
    console.log(
      "backup_crypto_passed round_trip=verified corruption=refused wrong_key=refused"
    );
  }
} catch (error) {
  const known =
    error instanceof assert.AssertionError ? "assertion" : error.message;
  console.error(
    `backup_drill_failed step=${/^[a-z_]+$/.test(known) ? known : "unexpected"}`
  );
  process.exitCode = 1;
} finally {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
}
