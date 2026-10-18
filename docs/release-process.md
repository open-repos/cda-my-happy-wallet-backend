# Release process

A release moves the integrated work of `develop` to `main`, records it in
`CHANGELOG.md`, tags it and publishes its notes. Production deployment stays a
manual GitLab action.

## Owner gates

1. Merging the release pull request into `main`.
2. Starting `deploy_production` in the GitLab `main` pipeline.

Everything else is automated or can be prepared by an agent.

## Version rules

`npm run release:prepare` reads `changes/unreleased/*.md` and selects the
smallest version allowed by the fragments:

| Fragment types present             | Release |
| ---------------------------------- | ------- |
| `removed`                          | major   |
| `added`, `changed` or `deprecated` | minor   |
| only `fixed` and `security`        | patch   |

`--bump major|minor|patch` or `--version x.y.z` selects a larger version. A
smaller one is refused.

## Prepare the release pull request

From an up-to-date `develop`:

```bash
git switch -c release/x.y.z origin/develop
npm run release:prepare -- --dry-run   # preview version and notes
npm run release:prepare                # write CHANGELOG.md, bump version, remove fragments
git add CHANGELOG.md package.json package-lock.json changes/unreleased
git commit -m "chore(release): x.y.z"
git push -u origin release/x.y.z
gh pr create --base main --head release/x.y.z --title "release: x.y.z" \
  --body "$(npm run --silent release:notes -- x.y.z)"
```

Agents run the `npm` commands in their Docker container. The pull request must
pass `Backend quality` and receive the owner's review. Highlight every
database migration and its recovery plan in the pull request.

## After the merge

The `publish-release` workflow runs on the push to `main`. When the version in
`package.json` changed, it:

1. creates the annotated tag `vx.y.z` on GitHub;
2. publishes the GitHub release with the matching `CHANGELOG.md` section;
3. pushes the tag to GitLab, where tags start no pipeline;
4. opens and merges a pull request from `main` back into `develop`, so the
   version and changelog reach `develop`.

Each step skips what already exists, so re-running a failed job resumes it. A
GitLab or sync failure only raises a warning with the manual command.

The `mirror-gitlab` workflow pushes `main` to GitLab, which starts the GitLab
pipeline. When it passes, the owner starts `deploy_production`. Deploy the
backend before a frontend release that depends on it.

A push to `main` that keeps the same version publishes nothing, and neither
does a push whose previous commit is unknown.

## Repository settings

- **Settings → Actions → General → Allow GitHub Actions to create and approve
  pull requests** must be enabled for step 4. Without it, open the sync pull
  request manually as the warning explains.
- `main` must stay the default branch: GitHub never deletes the default branch
  after the sync pull request merges, even with automatic branch deletion.
- A merge performed by the workflow token starts no other workflow, so the
  GitLab `develop` mirror catches up on the next push to `develop`.
