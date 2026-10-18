# Unreleased change fragments

Add one Markdown file for each user-visible or public API pull request. Name it `<issue>-<short-topic>.md`, for example `42-refresh-session-replay.md`.

Use this format:

```markdown
---
type: security
issue: 42
---

Revoked a refresh-session family when a previously rotated token was replayed.
```

Allowed types follow Keep a Changelog: `added`, `changed`, `deprecated`, `removed`, `fixed`, and `security`.

Write one concise sentence in past tense from the user's or API consumer's point of view. A release pull request collects these entries under the matching version in `CHANGELOG.md`, then removes the collected fragment files.

## User line

Add an optional `user:` line in French when people using My Happy Wallet will notice the change and the frontend release does not already describe it, for example a forced sign-in or corrected balances. Write one plain sentence without technical terms, addressed to the user:

```markdown
---
type: security
issue: 35
user: Pour renforcer la sécurité, vous devrez vous reconnecter une fois après la mise à jour.
---

Required the configured JWT issuer and purpose audience and revoked existing refresh sessions at cutover.
```

The release collects these lines into `changes/releases/<version>.md`, published as the « Pour les utilisateurs » part of the GitHub and GitLab releases. Omit the line for API-only, internal or security-hardening changes that users cannot notice.

Documentation, tests, refactoring, and delivery-only changes may omit a fragment when they do not change user-visible behavior or the public API. State that choice in the pull request checklist.
