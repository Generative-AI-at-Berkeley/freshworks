# Contributing

## Flow

1. Pick up a ticket from [docs/tickets.md](docs/tickets.md). If your work
   has no ticket, ask in the channel before starting anything bigger than a
   docs fix.
2. Branch from `main`: `<ticket>-<short-name>`, for example `be-2-dedupe`.
3. Keep PRs small. One reviewable idea per PR, ideally under 400 changed lines
   excluding fixtures and lockfile. A ticket is often several PRs.
4. Open the PR early as a draft if you want feedback on direction.
5. Title: `<ticket>: what changed`, for example `BE-2: dedupe on msg_id`.
   Work with no ticket uses `chore:`, `docs:`, `ci:` or `deps:`. CI checks this.
6. Fill in the template, especially "How I checked it".
7. One approving review and a green `ci-ok` check are required to merge.
   Merges are squash only, so the PR title becomes the commit on `main`.

`main` is protected. Nobody pushes to it directly, including maintainers.

## Reviews

- Review within one working day. If you cannot, say so on the PR.
- Reviewers check behaviour and the rules in AGENTS.md, not style. Prettier
  and ESLint own style.
- Leave a clear verdict. "Approve with nits" means the nits are optional.
- Contract changes (`packages/contracts`) need a reviewer from each team.

## Commits

Inside a PR, commit however you like. Squash merge discards them. Keep
messages short and plain: `handle 429 retry-after`, not a paragraph.

## Tests

- Unit tests live beside the code as `*.test.ts` (Vitest).
- Tests that need Postgres are `*.int.test.ts` and run with `pnpm test:int`.
- End-to-end tests live in `e2e/` and run against the compose stack.
- A bug fix comes with a test that fails without the fix.
- Never weaken or delete a test to make CI pass. If a test is wrong, say why
  in the PR and fix the test on its own.

## Dependencies

Add one only when it saves real work, and say why in the PR. Versions are
pinned exactly (`.npmrc` sets `save-exact`). Dependabot opens weekly grouped
updates. The dependency review check blocks high-severity advisories and
copyleft licences.

## Changesets

A PR that changes what a package does adds a changeset. Each package gets its
own version and `CHANGELOG.md`.

1. Run `pnpm changeset`.
2. Pick the packages you changed and the bump: `patch` for a fix, `minor` for
   something new, `major` for a break (a contract change other code must
   follow).
3. Write one line a reader of the changelog would understand.
4. Commit the new file in `.changeset/` with the rest of the PR.

Tests, docs and CI changes do not need one.

To release, a maintainer runs `pnpm changeset version`, opens a `chore:` PR
with the bumps and changelogs, merges it, then tags `main` with `vX.Y.Z` and
pushes the tag. The release workflow publishes the images to GHCR with
provenance and an SBOM.

## Using AI tools

Encouraged, with the same bar as hand-written code: you own every line, you
have read it, and you can explain it in review.

- Give the tool the context it needs: the ticket, AGENTS.md, the interface
  you are implementing, and the old PRs as reference (see ADR 0004).
- Check its claims about Kiro, Cursor and Claude Code formats against a real
  install. Formats change and models guess.
- Never give it real session data, the roster, or internal documents.
