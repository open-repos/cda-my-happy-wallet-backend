# Backend Test Environment

This document defines the target isolated test environment for the backend.
It is a prerequisite for creating `docker-compose.test.yml`.

## Current State

- Tests currently run inside the workspace `agent-node` container.
- The backend and its development toolchain use Node.js 22. ESLint 10 requires
  Node.js 22.13 or newer within that release line.
- The current `npm test` script is still transitional and delegates to `npm run type-check`.
- API characterization tests use Supertest without a real database connection.

## Target Compose Services

`backend-test`:

- Build from the future backend Dockerfile using a `dev` or `test` target.
- Run as user `node` / UID `1000`.
- Use `NODE_ENV=test`.
- Run `npm test` by default once the Jest migration is in place.
- Do not expose application ports by default.
- Use only test placeholders for JWT, registration token and mail variables.
- Point `DATABASE_URL` and `SHADOW_DATABASE_URL` to the test database service.

`mysql-test`:

- Use `mysql:8.0`.
- Create only disposable test databases.
- Use a healthcheck before `backend-test` starts.
- Prefer no host port binding. Add a local-only debug port only when needed.
- Use a named test volume or `tmpfs`, never a development or production volume.

## Safety Rules

- Tests must never point to a development or production database.
- Test secrets must be placeholders, not real secrets.
- `.env.example` files must be added before the Compose file is created.
- Database migrations for tests must be non-destructive outside the disposable test database.
- `npm audit fix` must not be run as part of the test environment setup without explicit approval.

## Future Command

```bash
docker compose -f docker-compose.test.yml run --rm backend-test npm test
```

## Blockers Before Creating `docker-compose.test.yml`

- Add backend and test `.env.example` files with placeholder values only.
- Decide the exact test command after Jest is configured.
- Decide whether the test database uses a named volume or `tmpfs`.
- Add repository/data-access tests that actually require `mysql-test`.
