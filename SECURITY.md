# Security

This repository is public. Treat everything committed here as published.

## Reporting

Report a vulnerability privately through
[GitHub security advisories](https://github.com/Generative-AI-at-Berkeley/freshworks/security/advisories/new).
Do not open a public issue or PR that describes it.

## If you committed something you should not have

A secret, an internal URL, a real name, or real session content:

1. Tell the maintainers in the team channel right away. Do not wait for review.
2. Assume it is compromised. Deleting the commit does not unpublish it: forks
   and caches keep it. Rotate any credential first.
3. Then remove it from history with the maintainers. Do not force-push `main`
   yourself.

## What keeps this from happening

- Internal endpoints, credentials and directory data reach the code only as
  configuration at runtime ([ADR 0007](docs/decisions/0007-public-repo-hygiene.md)).
- gitleaks scans full history in CI, and staged changes in the pre-commit hook
  when it is installed. `.gitleaks.toml` adds a rule for internal hostnames.
- GitHub secret scanning with push protection is on for the repo.
- `.gitignore` blocks the obvious files: `.env`, `*.xlsx` roster exports,
  Cursor `*.vscdb` databases, and the collector's local state.
