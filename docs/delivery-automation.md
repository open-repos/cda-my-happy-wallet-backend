# Automated delivery to `develop`

Routine agent pull requests can reach `develop` automatically while production
remains controlled by the project owner.

## Pull request paths

Every pull request must select exactly one automation option in the pull request
template.

- Select **Eligible for automatic merge into `develop`** only for a trusted,
  same-repository change with a low operational and product risk.
- Select **Requires owner review** for CI, dependencies, authentication,
  sessions, security, database access, migrations, API contracts, financial
  calculations and any change whose rollback or user impact needs human
  judgment.

The auto-merge workflow checks the author, repository, explicit selection and
changed paths without checking out or executing pull request code. GitHub then
waits for all branch protection requirements before performing a merge commit.
The primary Issue declared as `Primary issue: Refs #N` is closed after the merge
to `develop`; related Issues remain open.

## GitLab mirror

The mirror workflow follows pushes to `develop` and `main`. It skips safely until
these GitHub repository Actions secrets exist:

- `GITLAB_DEPLOY_KEY`: private SSH key for a dedicated GitLab identity with
  write access to this repository only;
- `GITLAB_KNOWN_HOSTS`: verified `known_hosts` entry for `gitlab.com`.

Register the matching public key as a writable GitLab deploy key for the backend
project. Keep the private key only in GitHub Actions secrets. The workflow
mirrors the current branch and does not create tags, releases or call a
deployment endpoint.

A push to GitLab `main` can start the existing GitLab pipeline, but its
production deployment job remains manual. Only the project owner starts that
job after staging acceptance. Database migrations therefore remain under owner
review and are never eligible for automatic merge.

## Required repository settings

Protect `develop` with the required check
`Backend format, lint, migrations, tests and build`. Only after that check is
required, enable **Allow auto-merge** in the GitHub repository settings.

Keep pull requests mandatory, required approvals at zero for this single-owner
repository, conversation resolution enabled and force pushes and deletions
blocked. The same quality check should protect `main`, where release pull
requests always require owner review.
