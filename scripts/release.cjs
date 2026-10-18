#!/usr/bin/env node
// Prepares a release from changes/unreleased fragments and prints release notes.
// Usage:
//   node scripts/release.cjs prepare [--bump major|minor|patch | --version x.y.z] [--date YYYY-MM-DD] [--dry-run]
//   node scripts/release.cjs notes <version>
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SECTIONS = [
  ["added", "Added"],
  ["changed", "Changed"],
  ["deprecated", "Deprecated"],
  ["removed", "Removed"],
  ["fixed", "Fixed"],
  ["security", "Security"],
];
const TYPES = new Set(SECTIONS.map(([type]) => type));
const BUMPS = ["patch", "minor", "major"];
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parseFragment(content, name) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${name}: missing front matter`);
  const fields = Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => line.match(/^(\w+):\s*(.*)$/))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.trim()])
  );
  if (!TYPES.has(fields.type)) {
    throw new Error(`${name}: unknown type "${fields.type}"`);
  }
  if (fields.issue !== undefined && !/^\d+$/.test(fields.issue)) {
    throw new Error(`${name}: issue must be a number`);
  }
  const text = match[2].trim().replace(/\s*\r?\n\s*/g, " ");
  if (!text) throw new Error(`${name}: empty description`);
  return {
    type: fields.type,
    issue: fields.issue ? Number(fields.issue) : null,
    text,
  };
}

function requiredBump(fragments) {
  const types = new Set(fragments.map((fragment) => fragment.type));
  if (types.has("removed")) return "major";
  if (types.has("added") || types.has("changed") || types.has("deprecated")) {
    return "minor";
  }
  return "patch";
}

function parseVersion(version) {
  const match = SEMVER.exec(version);
  if (!match) throw new Error(`Invalid version "${version}"`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function bumpVersion(current, bump) {
  const [major, minor, patch] = parseVersion(current);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump "${bump}"`);
}

function formatEntry({ text, issue }) {
  if (issue === null) return `- ${text}`;
  return text.endsWith(".")
    ? `- ${text.slice(0, -1)} (#${issue}).`
    : `- ${text} (#${issue})`;
}

function renderBody(fragments) {
  const ordered = [...fragments].sort(
    (left, right) => (left.issue ?? Infinity) - (right.issue ?? Infinity)
  );
  return SECTIONS.flatMap(([type, title]) => {
    const entries = ordered.filter((fragment) => fragment.type === type);
    if (entries.length === 0) return [];
    return [`### ${title}`, "", ...entries.map(formatEntry), ""];
  })
    .join("\n")
    .trimEnd();
}

// Without a following release heading, the new release goes before the
// trailing "[x.y.z]: url" link references so they stay at the end.
function findInsertionPoint(lines, searchFrom) {
  const next = lines.findIndex(
    (line, index) => index >= searchFrom && line.startsWith("## ")
  );
  if (next !== -1) return next;
  let end = lines.length;
  while (end > searchFrom && !lines[end - 1].trim()) end -= 1;
  let start = end;
  while (start > searchFrom && /^\[[^\]]+\]:\s/.test(lines[start - 1])) {
    start -= 1;
  }
  return start === end ? lines.length : start;
}

// Follows the heading style already used by the changelog: Keep a Changelog
// "## [x.y.z] - date" when an [Unreleased] heading exists, "## x.y.z (date)" otherwise.
function insertRelease(changelog, version, date, body) {
  const eol = changelog.includes("\r\n") ? "\r\n" : "\n";
  const lines = changelog.split(/\r?\n/);
  const unreleased = lines.findIndex((line) =>
    /^## \[Unreleased\]/i.test(line)
  );
  const heading =
    unreleased === -1 ? `## ${version} (${date})` : `## [${version}] - ${date}`;
  const insertAt = findInsertionPoint(lines, unreleased + 1);
  const block = [heading, "", ...body.split("\n"), ""];
  if (unreleased === -1) {
    lines.splice(insertAt, 0, ...block);
    return lines.join(eol);
  }
  if (lines.slice(unreleased + 1, insertAt).some((line) => line.trim())) {
    throw new Error(
      "CHANGELOG.md has entries under [Unreleased]: move them to changes/unreleased fragments first"
    );
  }
  lines.splice(unreleased + 1, insertAt - unreleased - 1, "", ...block);
  return lines.join(eol);
}

function extractNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const escaped = version.replace(/\./g, "\\.");
  const heading = new RegExp(`^## (\\[${escaped}\\]|${escaped})(\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1)
    throw new Error(`Version ${version} not found in CHANGELOG.md`);
  const next = lines.findIndex(
    (line, index) => index > start && line.startsWith("## ")
  );
  return lines
    .slice(start + 1, next === -1 ? lines.length : next)
    .join("\n")
    .trim();
}

function readFragments(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".md"))
    .sort()
    .map((name) => {
      const file = path.join(directory, name);
      return { file, ...parseFragment(fs.readFileSync(file, "utf8"), name) };
    });
}

function parseOptions(args) {
  const options = { dryRun: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const value = () => {
      const next = args[++index];
      if (!next || next.startsWith("--")) {
        throw new Error(`${arg} needs a value`);
      }
      return next;
    };
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--bump") options.bump = value();
    else if (arg === "--version") options.version = value();
    else if (arg === "--date") options.date = value();
    else throw new Error(`Unknown option "${arg}"`);
  }
  if (options.date && !/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
    throw new Error("--date must use YYYY-MM-DD");
  }
  if (options.bump && !BUMPS.includes(options.bump)) {
    throw new Error(`--bump must be one of ${BUMPS.join(", ")}`);
  }
  if (options.bump && options.version) {
    throw new Error("Use either --bump or --version");
  }
  return options;
}

function prepare(root, args) {
  const options = parseOptions(args);
  const packageFile = path.join(root, "package.json");
  const changelogFile = path.join(root, "CHANGELOG.md");
  const current = JSON.parse(fs.readFileSync(packageFile, "utf8")).version;
  const fragments = readFragments(path.join(root, "changes", "unreleased"));
  if (fragments.length === 0) {
    throw new Error("No fragment in changes/unreleased: nothing to release");
  }

  const minimum = requiredBump(fragments);
  const version =
    options.version ?? bumpVersion(current, options.bump ?? minimum);
  if (compareVersions(version, current) <= 0) {
    throw new Error(`Version ${version} must be greater than ${current}`);
  }
  if (compareVersions(version, bumpVersion(current, minimum)) < 0) {
    throw new Error(
      `Fragments require at least a ${minimum} release (${bumpVersion(
        current,
        minimum
      )})`
    );
  }

  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const body = renderBody(fragments);
  const changelog = insertRelease(
    fs.readFileSync(changelogFile, "utf8"),
    version,
    date,
    body
  );

  console.log(
    `Release ${current} -> ${version} (${fragments.length} fragments)\n`
  );
  console.log(extractNotes(changelog, version));
  if (options.dryRun) return;

  // npm version runs first so a failure leaves every file untouched.
  const npm = spawnSync(
    "npm",
    ["version", version, "--no-git-tag-version", "--allow-same-version=false"],
    { cwd: root, stdio: "inherit" }
  );
  if (npm.status !== 0) throw new Error("npm version failed");
  fs.writeFileSync(changelogFile, changelog);
  for (const fragment of fragments) fs.unlinkSync(fragment.file);
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = process.cwd();
  if (command === "prepare") return prepare(root, args);
  if (command === "notes" && args.length === 1) {
    const changelog = fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
    return console.log(extractNotes(changelog, args[0]));
  }
  throw new Error(
    "Usage: release.cjs prepare [--bump major|minor|patch | --version x.y.z] [--date YYYY-MM-DD] [--dry-run] | notes <version>"
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  bumpVersion,
  extractNotes,
  insertRelease,
  parseFragment,
  renderBody,
  requiredBump,
};
