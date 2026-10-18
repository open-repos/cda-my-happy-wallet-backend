const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  bumpVersion,
  composeNotes,
  extractNotes,
  insertRelease,
  parseFragment,
  renderBody,
  renderUserNotes,
  requiredBump,
  updateLinks,
} = require("../../scripts/release.cjs");

const fragment = (type, issue, text) =>
  `---\ntype: ${type}\nissue: ${issue}\n---\n\n${text}\n`;

// Fragment parsing
assert.deepStrictEqual(
  parseFragment(fragment("fixed", 12, "Fixed a\nwrapped line."), "12.md"),
  { type: "fixed", issue: 12, text: "Fixed a wrapped line.", user: null }
);
const withUser = (user) =>
  `---\ntype: added\nissue: 4\nuser: ${user}\n---\n\nAdded goals.\n`;
assert.equal(
  parseFragment(withUser("Suivez vos objectifs : épargne et date."), "4.md")
    .user,
  "Suivez vos objectifs : épargne et date."
);
assert.equal(
  parseFragment(withUser('"Texte entre guillemets."'), "4.md").user,
  "Texte entre guillemets."
);
assert.throws(() => parseFragment(withUser('""'), "4.md"), /empty user line/);

// User notes keep only French user lines, grouped and ordered by issue
assert.equal(
  renderUserNotes([
    { type: "security", issue: 9, user: "Reconnectez-vous." },
    { type: "added", issue: 21, user: "Objectifs." },
    { type: "fixed", issue: 3, user: null },
    { type: "added", issue: 2, user: "Calendrier." },
    { type: "removed", issue: 5, user: "Ancien export retiré." },
  ]),
  [
    "### Nouveautés",
    "",
    "- Calendrier.",
    "- Objectifs.",
    "",
    "### Sécurité",
    "",
    "- Reconnectez-vous.",
    "",
    "### À savoir",
    "",
    "- Ancien export retiré.",
  ].join("\n")
);
assert.equal(
  renderUserNotes([{ type: "fixed", issue: 1, user: null }]),
  "Aucun changement visible pour les utilisateurs dans cette version."
);
assert.equal(composeNotes("### Fixed\n\n- A.", null), "### Fixed\n\n- A.");
assert.equal(
  composeNotes("### Fixed\n\n- A.", "### Corrections\n\n- B.\n"),
  "## Pour les utilisateurs\n\n### Corrections\n\n- B.\n\n## Détail technique\n\n### Fixed\n\n- A."
);
assert.throws(() => parseFragment("no front matter", "x.md"), /front matter/);
assert.throws(
  () => parseFragment(fragment("improved", 1, "Text."), "x.md"),
  /unknown type/
);
assert.throws(
  () => parseFragment(fragment("added", "abc", "Text."), "x.md"),
  /issue must be a number/
);
assert.throws(() => parseFragment(fragment("added", 1, ""), "x.md"), /empty/);

// Version selection
assert.equal(requiredBump([{ type: "fixed" }, { type: "security" }]), "patch");
assert.equal(requiredBump([{ type: "fixed" }, { type: "added" }]), "minor");
assert.equal(requiredBump([{ type: "added" }, { type: "removed" }]), "major");
assert.equal(bumpVersion("1.1.0", "patch"), "1.1.1");
assert.equal(bumpVersion("1.1.3", "minor"), "1.2.0");
assert.equal(bumpVersion("1.1.3", "major"), "2.0.0");

// Rendering groups by Keep a Changelog section and orders by issue
const body = renderBody([
  { type: "security", issue: 9, text: "Hardened sessions." },
  { type: "added", issue: 21, text: "Added goals." },
  { type: "added", issue: 3, text: "Added events" },
  { type: "fixed", issue: null, text: "Fixed a typo." },
]);
assert.equal(
  body,
  [
    "### Added",
    "",
    "- Added events (#3)",
    "- Added goals (#21).",
    "",
    "### Fixed",
    "",
    "- Fixed a typo.",
    "",
    "### Security",
    "",
    "- Hardened sessions (#9).",
  ].join("\n")
);

// Plain heading style (backend changelog)
const plain =
  "# Changelog\n\nIntro.\n\n## 1.1.0 (2026-07-20)\n\n### Added\n\n- Old.\n";
const plainResult = insertRelease(
  plain,
  "1.2.0",
  "2026-10-18",
  "### Fixed\n\n- New."
);
assert.equal(
  plainResult,
  "# Changelog\n\nIntro.\n\n## 1.2.0 (2026-10-18)\n\n### Fixed\n\n- New.\n\n## 1.1.0 (2026-07-20)\n\n### Added\n\n- Old.\n"
);
assert.equal(extractNotes(plainResult, "1.2.0"), "### Fixed\n\n- New.");
assert.equal(extractNotes(plainResult, "1.1.0"), "### Added\n\n- Old.");

// Keep a Changelog style with an [Unreleased] heading (frontend changelog)
const kac =
  "# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-07-19\n\n- Old.\n";
const kacResult = insertRelease(
  kac,
  "1.1.0",
  "2026-10-18",
  "### Added\n\n- New."
);
assert.equal(
  kacResult,
  "# Changelog\n\n## [Unreleased]\n\n## [1.1.0] - 2026-10-18\n\n### Added\n\n- New.\n\n## [1.0.0] - 2026-07-19\n\n- Old.\n"
);
assert.equal(extractNotes(kacResult, "1.1.0"), "### Added\n\n- New.");
assert.throws(() => extractNotes(kacResult, "9.9.9"), /not found/);
assert.throws(() => extractNotes(kacResult, "1.1"), /not found/);

// Manual entries under [Unreleased] are refused instead of being dropped
assert.throws(
  () =>
    insertRelease(
      "# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Manual.\n\n## [1.0.0] - 2026-07-19\n",
      "1.1.0",
      "2026-10-18",
      "### Added\n\n- New."
    ),
  /entries under \[Unreleased\]/
);

// First release keeps the trailing link references at the end
assert.equal(
  insertRelease(
    "# Changelog\n\n## [Unreleased]\n\n[Unreleased]: https://example.test/compare\n",
    "0.1.0",
    "2026-10-18",
    "### Added\n\n- New."
  ),
  "# Changelog\n\n## [Unreleased]\n\n## [0.1.0] - 2026-10-18\n\n### Added\n\n- New.\n\n[Unreleased]: https://example.test/compare\n"
);

// CRLF changelogs keep CRLF line endings
const crlf = plain.replace(/\n/g, "\r\n");
const crlfResult = insertRelease(
  crlf,
  "1.2.0",
  "2026-10-18",
  "### Fixed\n\n- New."
);
assert.equal(crlfResult, plainResult.replace(/\n/g, "\r\n"));
assert.equal(extractNotes(crlfResult, "1.2.0"), "### Fixed\n\n- New.");

// Comparison links move to the new version
const linked =
  "## [1.0.0] - 2026-07-19\n\n- Old.\n\n[Unreleased]: https://gitlab.com/g/p/-/compare/v1.0.0...develop\n[1.0.0]: https://gitlab.com/g/p/-/commits/v1.0.0\n";
assert.equal(
  updateLinks(linked, "1.0.0", "1.1.0"),
  "## [1.0.0] - 2026-07-19\n\n- Old.\n\n[Unreleased]: https://gitlab.com/g/p/-/compare/v1.1.0...develop\n[1.1.0]: https://gitlab.com/g/p/-/compare/v1.0.0...v1.1.0\n[1.0.0]: https://gitlab.com/g/p/-/commits/v1.0.0\n"
);
assert.equal(updateLinks(plain, "1.1.0", "1.2.0"), plain);
assert.equal(updateLinks(linked, "0.9.0", "1.1.0"), linked);

// End-to-end runs against a disposable fixture
const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-test-"));
try {
  fs.mkdirSync(path.join(root, "changes", "unreleased"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.1.0" })
  );
  fs.writeFileSync(path.join(root, "CHANGELOG.md"), plain);
  fs.writeFileSync(
    path.join(root, "changes", "unreleased", "5-thing.md"),
    fragment("added", 5, "Added a thing.")
  );
  const script = path.resolve(__dirname, "../../scripts/release.cjs");
  const run = (...args) =>
    spawnSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: "utf8",
    });

  const dryRun = run("prepare", "--dry-run", "--date", "2026-10-18");
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /Release 1\.1\.0 -> 1\.2\.0 \(1 fragments\)/);
  assert.match(dryRun.stdout, /- Added a thing \(#5\)\./);
  assert.equal(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), plain);
  assert.ok(
    fs.existsSync(path.join(root, "changes", "unreleased", "5-thing.md"))
  );

  const tooSmall = run("prepare", "--dry-run", "--bump", "patch");
  assert.notEqual(tooSmall.status, 0);
  assert.match(tooSmall.stderr, /at least a minor release/);

  const notGreater = run("prepare", "--dry-run", "--version", "1.1.0");
  assert.notEqual(notGreater.status, 0);
  assert.match(notGreater.stderr, /must be greater/);

  const missingValue = run("prepare", "--dry-run", "--bump");
  assert.notEqual(missingValue.status, 0);
  assert.match(missingValue.stderr, /--bump needs a value/);

  const badDate = run("prepare", "--dry-run", "--date", "18/10/2026");
  assert.notEqual(badDate.status, 0);
  assert.match(badDate.stderr, /YYYY-MM-DD/);

  fs.writeFileSync(
    path.join(root, "changes", "unreleased", "6-fix.md"),
    "---\ntype: fixed\nissue: 6\nuser: Les soldes sont justes.\n---\n\nFixed balances.\n"
  );
  const written = run("prepare", "--date", "2026-10-18");
  assert.equal(written.status, 0, written.stderr);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
      .version,
    "1.2.0"
  );
  assert.equal(
    fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"),
    insertRelease(
      plain,
      "1.2.0",
      "2026-10-18",
      "### Added\n\n- Added a thing (#5).\n\n### Fixed\n\n- Fixed balances (#6)."
    )
  );
  assert.equal(
    fs.readFileSync(path.join(root, "changes", "releases", "1.2.0.md"), "utf8"),
    "### Corrections\n\n- Les soldes sont justes.\n"
  );
  const notes = run("notes", "1.2.0");
  assert.equal(notes.status, 0, notes.stderr);
  assert.match(
    notes.stdout,
    /^## Pour les utilisateurs\n\n### Corrections\n\n- Les soldes sont justes\.\n\n## Détail technique\n\n### Added/
  );
  assert.deepStrictEqual(
    fs.readdirSync(path.join(root, "changes", "unreleased")),
    []
  );

  const technicalOnly = run("notes", "1.1.0");
  assert.equal(technicalOnly.status, 0, technicalOnly.stderr);
  assert.equal(technicalOnly.stdout, "### Added\n\n- Old.\n");

  fs.writeFileSync(
    path.join(root, "changes", "unreleased", "7-next.md"),
    fragment("fixed", 7, "Fixed next.")
  );
  fs.writeFileSync(path.join(root, "changes", "releases", "1.2.1.md"), "x\n");
  const existingNotes = run("prepare", "--dry-run");
  assert.notEqual(existingNotes.status, 0);
  assert.match(existingNotes.stderr, /1\.2\.1\.md already exists/);
  fs.unlinkSync(path.join(root, "changes", "unreleased", "7-next.md"));

  const nothingLeft = run("prepare");
  assert.notEqual(nothingLeft.status, 0);
  assert.match(nothingLeft.stderr, /nothing to release/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log("release script tests passed");
