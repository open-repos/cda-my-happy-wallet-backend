# Contributing

GitHub is the collaboration workspace for issues, branches, and pull requests. GitLab receives release-ready code and runs the deployment pipeline.

## Development flow

1. Create or select a GitHub Issue with a clear result and acceptance criteria.
2. Branch from the latest `develop` using `feature/<topic>`, `fix/<topic>`, or `refactor/<topic>`.
3. Implement one coherent change and keep commits focused and descriptive.
4. Add a fragment to `changes/unreleased/` for a user-visible or public API change.
5. Run the checks listed in `AGENTS.md` with the disposable test database.
6. Push the topic branch and open a pull request targeting `develop`. Add `Refs #<number>` for the selected Issue and for each related Issue.
7. Select the automatic path only for an eligible low-risk change. After a successful merge into `develop`, automation closes the single completed primary Issue and leaves related Issues open.
8. Release changes later move from `develop` to `main` through a separate pull request.

The eligibility rules, GitLab mirror setup and required branch check are
documented in `docs/delivery-automation.md`.

Use an imperative commit subject that identifies the delivered behavior, for example:

```text
fix(auth): revoke replayed refresh sessions
```

Use the commit body to explain relevant decisions, constraints, API compatibility, and migration steps. Avoid bundling unrelated features into one commit.

## Issue links

GitHub processes closing keywords only when changes reach the repository's default branch, currently `main`. Because development pull requests target `develop`, writing `Closes #42` there does not close Issue #42 at merge time.

Use these rules:

- `Refs #42` links work or context without promising that Issue #42 is complete.
- Put the single completed Issue on the exact `Primary issue: Refs #42` line. After a pull request is merged into `develop`, automation comments with the delivering PR and closes it.
- `Closes #42` is reserved for a pull request targeting `main` that directly completes the Issue.
- Mention every related Issue separately. Related Issues are never closed by this automation.

## Release and deployment

`develop` contains integrated work for the next version. `main` contains the release candidate accepted by the project owner.

Creating a release includes collecting the unreleased change fragments into `CHANGELOG.md`, choosing a version, merging the release pull request, and creating matching GitHub and GitLab tags. The project owner explicitly authorizes these operations.

Production is deployed manually from the GitLab pipeline after the GitLab `main` branch has been synchronized and its pipeline has passed. Backend database migrations run before the container switch, so every release with a migration must document its compatibility and recovery plan. Agents must not trigger production deployment.
