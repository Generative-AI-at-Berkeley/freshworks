# 0007: Public repo, internal anything arrives as config

- Status: accepted
- Date: 2026-11-26
- Deciders: project leads, following the sponsor spec (4.2)

## Context

This repo is public. The spec treats everything committed to a public org as
published. Freshworks keeps real endpoints and credentials in their own repo
and gives them to us as configuration.

## Decision

- No internal URLs, hostnames, credentials, employee names or real session
  content anywhere in the repo, including history, fixtures and docs.
- Every Freshworks-specific value is read from the environment or a managed
  config file at runtime and validated in that package's `config.ts`. No
  defaults point at anything real.
- Fixtures and demo data are synthetic (`packages/testkit`), with obviously
  fake values like `example.com` and `dev_SYNTHETIC0001`.
- Enforcement: gitleaks on full history in CI with a rule for internal
  hostnames, an optional pre-commit scan, GitHub push protection, and
  `.gitignore` entries for roster exports and harness databases.

## Consequences

- Integration with the real pipeline and directory happens in a Freshworks
  environment we may not see. Our mocks have to be faithful, and anything we
  learn about the real systems is written into docs/contracts/.
