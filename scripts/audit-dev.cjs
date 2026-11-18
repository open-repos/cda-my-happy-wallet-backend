#!/usr/bin/env node
// Audits all dependencies, development included, like
// `npm audit --include=dev --audit-level=low`, but accepts the owner-approved
// temporary exceptions of dev-audit-exceptions.json (#190). Any other advisory,
// package, compatible fix, changed advisory range or expired exception fails.
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const advisoryId = (url) => String(url).split("/").pop();

function readError(report) {
  if (report && report.error) {
    const { code = "", summary = "" } = report.error;
    return `npm audit failed: ${code} ${summary}`.trim();
  }
  const readable =
    report &&
    report.auditReportVersion === 2 &&
    report.vulnerabilities &&
    typeof report.vulnerabilities === "object";
  return readable ? null : "unreadable npm audit report";
}

function checkEntry(name, vulnerability, active) {
  const errors = [];
  const advisories = vulnerability.via.filter((via) => typeof via === "object");
  const owners = active.filter((exception) =>
    exception.packages.includes(name)
  );
  // An advisory is only accepted by an exception covering this package.
  for (const via of advisories)
    if (!owners.some((exception) => exception.advisory === advisoryId(via.url)))
      errors.push(`${name}: advisory ${advisoryId(via.url)} is not excepted`);
  if (owners.length === 0) {
    const ids = active.map((exception) => exception.advisory).join(", ");
    errors.push(`${name}: outside the excepted chain of ${ids || "nothing"}`);
  }
  for (const exception of owners) {
    if (exception.package !== name) continue;
    if (vulnerability.isDirect)
      errors.push(`${name}: direct dependency, not covered by the exception`);
    if (vulnerability.fixAvailable === true)
      errors.push(
        `${name}: a compatible fix is available, remove the exception`
      );
    for (const via of advisories)
      if (
        advisoryId(via.url) === exception.advisory &&
        via.range !== exception.range
      )
        errors.push(
          `${name}: advisory range changed from ${exception.range} to ${via.range}, review the exception`
        );
  }
  return errors;
}

function invalidException(exception) {
  const valid =
    exception &&
    /^GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}$/.test(exception.advisory) &&
    typeof exception.package === "string" &&
    typeof exception.range === "string" &&
    Array.isArray(exception.packages) &&
    exception.packages.includes(exception.package) &&
    DATE.test(String(exception.expires)) &&
    Number.isInteger(exception.issue);
  return valid
    ? null
    : `invalid exception ${JSON.stringify(
        exception
      )}: advisory, package, range, packages, expires and issue are required`;
}

function evaluate(report, exceptions, today) {
  if (!DATE.test(String(today)))
    return {
      ok: false,
      errors: [`invalid date ${today}`],
      accepted: [],
      notices: [],
    };
  const unreadable = readError(report);
  if (unreadable)
    return { ok: false, errors: [unreadable], accepted: [], notices: [] };

  const errors = [];
  const active = [];
  for (const exception of exceptions) {
    const invalid = invalidException(exception);
    if (invalid) errors.push(invalid);
    else if (today > exception.expires)
      errors.push(
        `${exception.advisory}: exception expired on ${exception.expires} (#${exception.issue})`
      );
    else active.push(exception);
  }

  const accepted = [];
  for (const [name, vulnerability] of Object.entries(report.vulnerabilities)) {
    const entryErrors = checkEntry(name, vulnerability, active);
    if (entryErrors.length === 0) accepted.push(name);
    errors.push(...entryErrors);
  }

  const notices = exceptions
    .filter(
      (exception) =>
        !Object.keys(report.vulnerabilities).includes(exception.package)
    )
    .map(
      (exception) =>
        `${exception.advisory}: no longer reported, remove the exception (#${exception.issue})`
    );
  return { ok: errors.length === 0, errors, accepted, notices };
}

function main() {
  const result = spawnSync("npm", ["audit", "--include=dev", "--json"], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    report = null;
  }
  const { exceptions } = require("./dev-audit-exceptions.json");
  const today = new Date().toISOString().slice(0, 10);
  const outcome = evaluate(report, exceptions, today);

  for (const notice of outcome.notices) console.log(`notice: ${notice}`);
  if (outcome.accepted.length > 0)
    console.log(
      `accepted by a temporary exception: ${outcome.accepted.join(", ")}`
    );
  if (!outcome.ok) {
    for (const error of outcome.errors) console.error(`error: ${error}`);
    if (result.stderr) console.error(result.stderr.trim());
    process.exitCode = 1;
    return;
  }
  console.log("development audit passed");
}

if (require.main === module) main();

module.exports = { evaluate };
