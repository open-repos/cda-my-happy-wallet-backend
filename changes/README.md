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

Documentation, tests, refactoring, and delivery-only changes may omit a fragment when they do not change user-visible behavior or the public API. State that choice in the pull request checklist.
