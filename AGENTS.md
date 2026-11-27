# AGENTS.md

Rules for any agent or person changing this repo. CI enforces what it can
(`pnpm check`). Reviewers enforce the rest. `CLAUDE.md` points here, so
Claude Code, Cursor and Codex all read the same rules.

## 1. Before you write code

- Read the ticket in [docs/tickets.md](docs/tickets.md) and the ADRs it
  touches in [docs/decisions](docs/decisions). Decisions there are settled. To
  change one, write a new ADR and get it reviewed. Do not just code around it.
- Find the interface you are implementing. Every ticket has one already, marked
  `TODO(<ticket>)`. Run `grep -rn "TODO(BE-2)" packages services` to find yours.
  Implement behind that interface. Do not invent a parallel one.
- If you are touching `packages/contracts`, both teams review. The contract is
  what lets the two teams work without waiting on each other.

## 2. Rules that are easy to break

**Data**

- The repo is public. No real names, emails, internal hostnames, real session
  content, or credentials, in code, fixtures, tests, docs or commit messages.
- Never paste real session logs, the roster, or the payload document into an
  AI tool that is not approved for Freshworks data. Your own sessions on your
  own machine are fine to inspect. They are not fine to commit.
- Fixtures are synthetic or anonymised by hand. Generate them with a committed
  script where the source is a database (Cursor's `state.vscdb`), never commit
  opaque binaries.

**Collector**

- Read only. Never write to, lock or migrate a harness's files. Open SQLite
  read-only and immutable, or copy it first.
- Detect formats. Do not assume one. Unknown format means a warning, not a crash.
- A value the harness does not record is left out. Never `0`. Zero means
  measured as zero, and the coverage and cost numbers depend on the difference.
- No prompt text, response text, file paths or file contents leave the
  machine. The policy check in `collector/src/policy` drops events that carry
  them, but do not rely on it. Map the right fields in the first place.
- Event IDs come from `eventId()` over stable source facts. Never
  `randomUUID()`, never a collection timestamp. Idempotency depends on it.

**Backend**

- Every write path is idempotent. Ingestion de-duplicates on `msg_id`. Jobs
  replace a day's rows in one transaction, so re-running gives the same answer.
- Access to an individual is checked twice: in the route through
  `AccessPolicy`, and in Postgres row-level security. Every allowed view of an
  individual writes `access_log` in the same transaction.
- No leaderboards. No API returns engineers ordered by usage, tokens or lines
  of code (spec section 8). Return distributions.
- Credits stay credits. Cost is `null` when there is no sourced rate. Never `0`.
- SQL is parameterised. Never concatenate request input into a query.

**Dashboard** (`apps/dashboard`)

- Dew is the design system. Use `@freshworks/dew-components` and Dew's CSS
  variables. No second component library, no hardcoded colors.
- The browser calls only this app's `/api` routes. Identity is added server
  side. Never forward a header the browser sent.
- Parse every API response with its schema from `packages/contracts`.
- Unknown renders as "Not measured" or "Not priced", never 0. A cost always
  shows its coverage.
- No view lists people ordered by a usage metric. Sort people by name.
- UI copy: sentence case, no exclamation points, no emoji. Errors say what
  broke and what to do.

**Everywhere**

- Configuration comes from the environment, validated with Zod in one
  `config.ts` per package. Nothing reads `process.env` anywhere else.
- Every status or kind is a `const` object with a type, like `Harness` or
  `ContentLevel`. No bare string literals for them elsewhere.
- Use the logger, not `console`. Never log a token, a request body or an event
  payload.

## 3. Writing rules (docs, comments, commit messages, API errors)

Text should read like a competent engineer wrote it in a hurry.

- No em dashes, en dashes, the ellipsis character, or curly quotes. CI fails on them.
- None of these words: leverage, utilize, seamless, robust, delve, unlock,
  elevate, streamline, empower, cutting-edge, game-changer, supercharge,
  effortless. CI fails on them too. ("Harness" is fine here. It is the domain term.)
- One idea per sentence. Do not end a section by restating it.
- Comments say why, not what. `// increment i` is noise. `// The pipeline
retries for 24h, so this must be idempotent` is useful.
- Error messages say what broke and what to do: "Invalid collector config.
  Check FWCOACH_* variables."

## 4. Before you commit

Run `pnpm check`. It runs ESLint, the content lint, Prettier, type checks,
unit tests and the build. If it fails, the work is not done.

If you changed a migration, also run `pnpm db:up && pnpm db:down && pnpm db:up`
against your local Postgres, then `pnpm test:int`.
