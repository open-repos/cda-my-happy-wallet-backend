# Changelog

All notable changes to this project are documented in this file.

## 1.1.0 (2026-07-20)

### Added

- Structured API validation errors for consistent frontend feedback.
- Local Docker development stack with MySQL, Mailpit, backend and frontend services.
- Liveness and readiness endpoints, including database availability checks.
- Characterization tests for authentication, token refresh, fixed operations and API errors.
- Unit and integration tests for domain services, adapters, repositories and error handling.

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
- Hardened the production container with a non-root user, read-only filesystem and dropped Linux capabilities.
- Restricted production database access to the dedicated backend Docker network.
