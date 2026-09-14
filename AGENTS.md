# Agent instructions

These instructions apply to the whole backend repository.

## Workflow

- Use GitHub Issues and pull requests to describe and review development work.
- Start work from `develop` on a dedicated `feature/*`, `fix/*`, or `refactor/*` branch.
- Open pull requests against `develop`. Keep `main` reserved for tested releases.
- Do not push directly to `develop` or `main`.
- An agent may push its working branch and open or update its pull request when the task authorizes repository updates.
- A trusted same-repository pull request to `develop` may opt into native auto-merge when every changed file is low risk and all required checks pass. Follow `docs/delivery-automation.md`.
- CI, dependencies, authentication, sessions, security, database access, migrations, API contracts and financial logic always require owner review.
- Do not merge a release pull request, create a tag or release, configure credentials, or trigger a deployment without explicit user authorization.
- Keep commits focused. Explain the behavior delivered and the reason for the change in each commit message.

## Backend boundaries

- Keep domain rules independent from Express, Prisma, email, and other infrastructure concerns.
- Validate and normalize external input at the API boundary.
- Preserve the public API response and error contracts unless the selected Issue explicitly changes them.
- Never expose passwords, tokens, cookies, private financial data, internal identifiers, or detailed production errors.
- Add focused tests for changes to authentication, authorization, ownership, validation, pagination, money calculations, or error handling.

## Database changes

- Create a new immutable Prisma migration for every schema change. Never edit a migration that may already have run outside the working environment.
- Test migrations against the disposable test database and document any data migration, compatibility constraint, or irreversible operation in the pull request.
- Production migrations run before the new backend container is selected and are not undone by application rollback. Highlight this risk for every production schema change.
- Never run development migrations, seeds, destructive resets, or tests against staging or production data.

## Validation

Run the backend checks with the disposable MySQL test database and test-only environment variables:

```bash
npm ci
npm run format
npm run lint
npm run db:deploy
npm run type-check
npm run test:services
npm run test:mailer
npm run test:smtp-mailer
npm run test:create-user
npm run test:token-service
npm run test:security-config
npm run test:auth-rate-limit
npm run test:http-limits
npm run test:cors
npm run test:password-reset
npm run test:refresh-sessions
npm run test:refresh-session-service
npm run test:native-session
npm run test:renew-session
npm run test:health
npm run test:delete-revenu-route
npm run test:operations-domain
npm run test:operations-migration
npm run test:operations-schema
npm run test:operations-use-cases
npm run test:operations-repositories
npm run test:operations-api
npm run test:budget-api-integration
npm run test:pagination
npm run test:pagination-openapi
npm run test:pagination-schema
npm run test:pagination-integration
npm run test:prisma-errors
npm run test:result-construction
npm run test:repositories
npm run test:api
npm run prisma:generate
npm run build
```

GitHub Actions and Codex Cloud may run these commands directly in their isolated checkout. Agents working from the parent `my-happy-wallet` workspace must use the Docker commands documented in the parent `agent-workspace/AGENTS.md`.

## Changes and pull requests

- Add a Markdown fragment under `changes/unreleased/` for every user-visible or public API change. Follow `changes/README.md`.
- Link every pull request to its GitHub Issue with `Refs #<number>`. Use additional `Refs #<number>` lines for related issues that the pull request does not complete.
- GitHub only applies `Closes #<number>` automatically when a pull request reaches the default branch, currently `main`. For pull requests to `develop`, declare exactly one completed `Primary issue: Refs #<number>`; automation closes it after a successful merge and leaves related Issues open.
- Use `Closes #<number>` in a pull request only when it targets the default branch and directly completes that issue.
- Describe the API impact, validation performed, configuration or migration needs, compatibility constraints, and known risks in the pull request.
- Never commit credentials, tokens, production data, or populated environment files. Document new variables in an example environment file.
- Production deployment remains a manual GitLab CI action performed by the project owner.
