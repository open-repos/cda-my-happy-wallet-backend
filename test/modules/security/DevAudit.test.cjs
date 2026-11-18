const assert = require("node:assert/strict");
const { evaluate } = require("../../../scripts/audit-dev.cjs");
const {
  exceptions: configuredExceptions,
} = require("../../../scripts/dev-audit-exceptions.json");

const ADVISORY = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const MAJOR_FIX = {
  name: "@typescript-eslint/parser",
  version: "8.47.0",
  isSemVerMajor: true,
};

const advisory = (overrides = {}) => ({
  source: 1247710,
  name: "picomatch",
  dependency: "picomatch",
  title:
    "picomatch vulnerable to ReDoS through single-branch repeated extglobs",
  url: ADVISORY,
  severity: "high",
  range: "<=4.0.7",
  ...overrides,
});

const entry = (name, via, overrides = {}) => ({
  name,
  severity: "high",
  isDirect: false,
  via,
  effects: [],
  range: "*",
  nodes: [`node_modules/${name}`],
  fixAvailable: MAJOR_FIX,
  ...overrides,
});

// Shape of `npm audit --include=dev --json` measured on 2026-11-18 (#190).
const picomatchReport = (changes = {}) => {
  const vulnerabilities = {
    "@typescript-eslint/parser": entry(
      "@typescript-eslint/parser",
      ["@typescript-eslint/typescript-estree"],
      { isDirect: true }
    ),
    "@typescript-eslint/typescript-estree": entry(
      "@typescript-eslint/typescript-estree",
      ["tinyglobby"]
    ),
    fdir: entry("fdir", ["picomatch"], { fixAvailable: true }),
    picomatch: entry("picomatch", [advisory()]),
    tinyglobby: entry("tinyglobby", ["fdir", "picomatch"]),
    ...changes,
  };
  for (const [name, value] of Object.entries(vulnerabilities))
    if (value === undefined) delete vulnerabilities[name];
  return { auditReportVersion: 2, vulnerabilities, metadata: {} };
};

const exceptions = [
  {
    advisory: "GHSA-fc5q-39xc-vjpf",
    package: "picomatch",
    range: "<=4.0.7",
    packages: [
      "picomatch",
      "fdir",
      "tinyglobby",
      "@typescript-eslint/typescript-estree",
      "@typescript-eslint/parser",
    ],
    expires: "2026-12-31",
    issue: 190,
  },
];

const BEFORE_EXPIRY = "2026-11-18";
const run = (report, today = BEFORE_EXPIRY) =>
  evaluate(report, exceptions, today);
const failsWith = (result, pattern) => {
  assert.equal(result.ok, false, "the audit must fail");
  assert.ok(
    result.errors.some((error) => pattern.test(error)),
    `expected an error matching ${pattern}, got ${JSON.stringify(
      result.errors
    )}`
  );
};

// The withdrawn advisory is no longer exempted in the actual configuration.
assert.deepEqual(configuredExceptions, []);
assert.equal(
  evaluate(
    { auditReportVersion: 2, vulnerabilities: {} },
    configuredExceptions,
    BEFORE_EXPIRY
  ).ok,
  true
);
failsWith(
  evaluate(picomatchReport(), configuredExceptions, BEFORE_EXPIRY),
  /picomatch: advisory GHSA-fc5q-39xc-vjpf is not excepted/
);

// A clean report passes and reports the unused exception.
const clean = run({ auditReportVersion: 2, vulnerabilities: {} });
assert.equal(clean.ok, true);
assert.deepEqual(clean.errors, []);
assert.match(clean.notices.join("\n"), /GHSA-fc5q-39xc-vjpf.*no longer/);

// The measured picomatch chain is accepted until the expiry date included.
const accepted = run(picomatchReport());
assert.deepEqual(accepted.errors, []);
assert.equal(accepted.ok, true);
assert.equal(accepted.accepted.length, 5);
assert.equal(run(picomatchReport(), "2026-12-31").ok, true);

// Expired exception fails, even when the report is unchanged.
failsWith(run(picomatchReport(), "2027-01-01"), /expired on 2026-12-31/);

// Any other advisory fails, even on a package of the chain.
failsWith(
  run(
    picomatchReport({
      tinyglobby: entry("tinyglobby", [
        "picomatch",
        advisory({
          name: "tinyglobby",
          url: "https://github.com/advisories/GHSA-xxxx-xxxx-xxxx",
        }),
      ]),
    })
  ),
  /tinyglobby: advisory GHSA-xxxx-xxxx-xxxx is not excepted/
);
failsWith(
  run(
    picomatchReport({
      lodash: entry("lodash", [
        advisory({
          name: "lodash",
          url: "https://github.com/advisories/GHSA-yyyy-yyyy-yyyy",
        }),
      ]),
    })
  ),
  /lodash: advisory GHSA-yyyy-yyyy-yyyy is not excepted/
);

// Another package reaching picomatch leaves the approved chain and fails.
failsWith(
  run(picomatchReport({ chokidar: entry("chokidar", ["picomatch"]) })),
  /chokidar: outside the excepted chain of GHSA-fc5q-39xc-vjpf/
);
failsWith(
  run(
    picomatchReport({
      picomatch: entry("picomatch", [advisory()], { isDirect: true }),
    })
  ),
  /picomatch: direct dependency/
);

// A compatible fix for the vulnerable package ends the exception.
failsWith(
  run(
    picomatchReport({
      picomatch: entry("picomatch", [advisory()], { fixAvailable: true }),
    })
  ),
  /picomatch: a compatible fix is available/
);

// A changed advisory range (for example a patched release) needs a new review.
failsWith(
  run(
    picomatchReport({
      picomatch: entry("picomatch", [advisory({ range: "<4.0.8" })]),
    })
  ),
  /picomatch: advisory range changed from <=4\.0\.7 to <4\.0\.8/
);

// Unreadable or failed audits never pass.
failsWith(run(null), /unreadable npm audit report/);
failsWith(run({ vulnerabilities: {} }), /unreadable npm audit report/);
failsWith(
  run({ error: { code: "ENOAUDIT", summary: "registry unreachable" } }),
  /npm audit failed: ENOAUDIT registry unreachable/
);
failsWith(
  evaluate(picomatchReport(), exceptions, "not-a-date"),
  /invalid date/
);

// Malformed exceptions never pass, in particular without an expiry date.
const { expires, ...withoutExpiry } = exceptions[0];
assert.equal(expires, "2026-12-31");
failsWith(
  evaluate(picomatchReport(), [withoutExpiry], "2099-01-01"),
  /invalid exception/
);
failsWith(
  evaluate(
    picomatchReport(),
    [{ ...exceptions[0], packages: "picomatch" }],
    BEFORE_EXPIRY
  ),
  /invalid exception/
);
failsWith(
  evaluate(
    picomatchReport(),
    [{ ...exceptions[0], expires: "31/12/2026" }],
    BEFORE_EXPIRY
  ),
  /invalid exception/
);

// An advisory is accepted only by the exception that covers its package.
const other = {
  ...exceptions[0],
  advisory: "GHSA-zzzz-zzzz-zzzz",
  package: "lodash",
  packages: ["lodash"],
};
failsWith(
  evaluate(
    picomatchReport({
      tinyglobby: entry("tinyglobby", [
        "picomatch",
        advisory({
          name: "tinyglobby",
          url: "https://github.com/advisories/GHSA-zzzz-zzzz-zzzz",
        }),
      ]),
    }),
    [...exceptions, other],
    BEFORE_EXPIRY
  ),
  /tinyglobby: advisory GHSA-zzzz-zzzz-zzzz is not excepted/
);

console.log("dev audit exception tests passed");
