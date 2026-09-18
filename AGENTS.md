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

## Planning and Issue selection

- Use the organization Project `open-repos/2` (`My Happy Wallet Roadmap`) as the cross-repository planning view. Its `Workflow`, `Priority`, `Effort`, `Kind`, `Milestone`, and `Repository` fields define ordering and progress.
- GitHub Issues are the source of truth for the executable specification and current work status. GitLab links in migrated Issues are historical references.
- The selected Issue and its dependency links remain authoritative for implementation. Project fields organize work but do not override the Issue scope or acceptance criteria.
- Read the complete Issue selected by the task before editing code. Its acceptance criteria, scope, dependencies, milestone, priority and effort apply to the implementation.
- Never implement an Issue labelled `kind/parent`. It groups executable child Issues.
- Start only an open Issue labelled `status/ready`, unless the user explicitly selects another Issue. Confirm that every Issue listed under its dependencies is closed.
- Use one lifecycle label at a time: `status/backlog`, `status/blocked`, `status/ready`, `status/in-progress`, `status/in-review`, or `status/done`.
- When GitHub write access is available, replace `status/ready` with `status/in-progress` when work starts and with `status/in-review` when the pull request opens. The merge workflow closes the primary Issue and applies `status/done`.
- In explicitly authorized batch mode, finish and validate one Issue and open its pull request before selecting the next eligible `status/ready` Issue. Use one branch and one pull request per Issue.
- When selecting work autonomously, prefer a `Ready` task from an already started milestone that is closest to completion. Re-read the Project and linked dependencies after each completed Issue.
- This repository is self-contained for Codex Cloud. Do not assume that the sibling local `agent-workspace` exists in a cloud checkout; use the selected GitHub Issue and this file.

## Backend boundaries

- Keep domain rules independent from Express, Prisma, email, and other infrastructure concerns.
- Validate and normalize external input at the API boundary.
- Preserve the public API response and error contracts unless the selected Issue explicitly changes them.
- Never expose passwords, tokens, cookies, private financial data, internal identifiers, or detailed production errors.
- Add focused tests for changes to authentication, authorization, ownership, validation, pagination, money calculations, or error handling.

## Cross-repository features

- Represent a feature spanning frontend and backend with one planning parent and one executable child Issue in each repository. Link the child Issues and record the blocking direction in their dependency sections and in `open-repos/2`.
- Run the backend child in the backend Codex Cloud environment and the frontend child in the frontend environment. Never modify or commit the other repository from the same cloud task.
- When the frontend depends on a new API contract, complete and merge the backend contract first. The frontend may prepare typed contracts, fixtures, or mocks in parallel only when the shared contract is already explicit.
- Open one pull request per child Issue. After both are merged into `develop`, run the cross-repository integration or staging validation required by the planning parent.
- If a selected backend Issue reveals required frontend work that is not covered by a linked Issue, create or request the frontend child Issue instead of widening the current pull request.

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
npm run test:registration-confirmation
npm run test:registration-confirmation-controller
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
npm run test:monthly-events-domain
npm run test:monthly-events-api
npm run test:monthly-events-persistence
npm run test:monthly-events-migration
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
