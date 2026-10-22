# Changelog

All notable changes to this project are documented in this file.

## 1.4.0 (2026-10-22)

### Added

- Added periodicity and personal percentages to fixed charges and applied their monthly personal cost to budget totals while preserving existing monthly charges and closed periods (#122).

## 1.3.0 (2026-10-21)

### Added

- Added weekly, quarterly and annual event repetitions with civil-date occurrences, inclusive end dates and per-occurrence resolutions (#109).
- Added a private read-only budget forecast over up to 24 months with projected balances and daily, weekly and monthly allowances (#110).
- Added a private read-only savings-capacity summary with goal contribution gaps, independent monthly balances and documented sustainability indicators (#111).
- Added owner-scoped potential events, explicit Simulation forecasts and savings capacity, confirmation, clearing and automatic expiry without affecting standard balances (#112).

### Security

- Updated the transitive `follow-redirects` dependency to 1.16.1 to fix two high-severity advisories on credential headers during cross-origin redirects (GHSA-q3jh-wrc6-jgq8, GHSA-8r9p-f939-6h3c) (#119).

## 1.2.0 (2026-10-18)

### Added

- Added authenticated financial goals with saved amount, monthly contribution and a calculated reach forecast to the public API (#21).
- Added authenticated monthly-event rules and paginated calendar occurrences to the public API (#23).
- Added monthly budget summaries with forecast, closed-period history, a pending event queue, occurrence realize/cancel commands and date/currency filters on the operation list to the public API (#29).
- Added `GET /v1/analytics/operations`, a bounded aggregate of real operations grouped by day, ISO week, month, year, category or kind, optionally split by category or kind, for configurable charts (#78).
- Added an optional Font Awesome Free icon to operation categories, validated against the icons available on both Web and mobile (#84).

### Changed

- Added a documented GitHub collaboration process and automated backend quality checks (#7).
- Replaced the API root's plain text response with a stable JSON service identity and public health route links (#53).
- Recalculated closed monthly balances and the following carries after an operation is added, edited or deleted in a past month, and exposed `revision` and `correctedAt` on summaries and history (#72).
- Carried each closed month's real remaining balance, positive or negative, into the next month and exposed `carryIn`, `carryFromMonth` and `monthResult` in budget summaries and history (#75).

### Fixed

- Redirected browser confirmation failures to safe frontend messages while preserving JSON API error statuses (#56).
- Retried concurrent recalculations of the same closed month up to five times with a short random backoff instead of failing intermittently with a server error (#80).

### Security

- Shared authentication rate limits across backend replicas instead of resetting counters per process (#33).
- Required the configured JWT issuer and purpose audience, revoked existing refresh sessions at cutover, and required users to sign in again or request a new pending registration link (#35).
- Updated backend dependencies to address the reported HTTP parsing, proxy address, mail transport and configuration vulnerabilities while preserving existing API contracts (#37).
- Rejected reused registration links and links whose signed email does not match the account being confirmed (#54).
- Stopped development HTTP access logs from recording tokens, concrete identifiers and private request values while preserving existing API responses (#94).
- Marked every API response, including authentication and error responses, as `Cache-Control: private, no-store` and stopped conditional `304` reuse, so browsers, proxies and service workers never store private data (#98).

## 1.1.0 (2026-07-20)

### Added

- Structured API validation errors for consistent frontend feedback.
- Local Docker development stack with MySQL, Mailpit, backend and frontend services.
- Liveness and readiness endpoints, including database availability checks.
- Characterization tests for authentication, token refresh, fixed operations and API errors.
- Unit and integration tests for domain services, adapters, repositories and error handling.
- Persistent refresh-session storage with atomic rotation and revocation primitives.

### Changed

- Migrated the production runtime to Node.js 22, TypeScript 5.9 and Prisma 6.
- Introduced repository interfaces for users and fixed operations.
- Extracted the remaining-budget calculator, JWT token service and mail adapters.
- Moved result construction out of repositories and centralized API and Prisma error handling.
- Added format, lint, type-check, test and build validation to GitLab CI.
- Replaced the legacy PM2 deployment with immutable Docker images identified by Git commit SHA.
- Added manual production deployment from `main`, health-gated rollout and automatic application rollback.

### Fixed

- Corrected the income deletion route.
- Rejected malformed or invalid Bearer tokens before protected controllers execute.
- Protected fixed-income and fixed-charge update routes with JWT authentication.
- Used route identifiers for ownership checks when updating fixed operations.
- Corrected registry authentication for the rootless BuildKit image job.
- Aligned the production runner tag and isolated the backend database network.
- Updated the transitive development dependency `js-yaml` to its patched release.

### Security

- Removed logs containing passwords, tokens, cookies and financial data.
- Made validated JWT payloads the authoritative identity for protected actions.
- Applied consistent `HttpOnly`, `SameSite=Strict` and production-only `Secure` attributes to authentication cookies.
- Validated reset tokens before database access and consumed them atomically with their expiration constraint.
- Rotated persisted refresh tokens atomically and revoked the session family when an old token is replayed.
- Added an idempotent server-side logout endpoint that revokes the current refresh session.
- Validated distinct JWT secrets of at least 32 characters when configuration loads.
- Rate-limited public authentication, registration, password reset and token refresh routes.
- Added centralized HTTP security headers with a scoped Swagger content security policy.
- Bounded JSON and form request bodies and normalized malformed or oversized payload errors.
- Enforced a server-side CORS allowlist with explicit methods and preflight caching.
- Disabled Swagger routes by default in production with an explicit opt-in.
- Removed sensitive user fields from admin responses and sanitized non-development error logs.
- Unified registration, password reset and refresh failures to reduce account enumeration.
- Restricted JWT signing and verification to HS256.
- Added a production configuration preflight before database migrations.
- Hardened the production container with a non-root user, read-only filesystem and dropped Linux capabilities.
- Restricted production database access to the dedicated backend Docker network.
