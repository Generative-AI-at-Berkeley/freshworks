# 0008: Repo layout and workspace boundaries

- Status: proposed
- Date: 2026-11-27
- Deciders: project leads

## Context

Two teams work in one monorepo ([ADR 0001](0001-typescript-monorepo.md)).
The layout and the import rules lived in people's heads and in review
comments. A wrong import compiles fine. It only shows up later, as a
collector that pulls in backend code or a dashboard bundle with test data in
it. AGENTS.md also has rules that reviewers kept catching by hand: no
`process.env` outside config, no `console`, no `randomUUID()` in the
collector, no hardcoded colors in the dashboard, and a ticket on every TODO.

## Decision

### Where new code goes

| Workspace              | Put new code in                                                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/contracts`   | `src/events/` for one event schema per file. `src/api/` for API response schemas, one file per route group. Shared enums like `harness.ts` sit at `src/`. Fixtures go in `fixtures/v2/`. Export everything from `src/index.ts`.                    |
| `packages/collector`   | `src/adapters/<harness>/index.ts` for a harness, registered in `adapters/registry.ts`. Pipeline stages have their own folder: `normalize/`, `policy/`, `buffer/`, `upload/`, `auth/`, `skills/`. Wiring is in `daemon.ts`, the entry in `main.ts`. |
| `services/ingest-mock` | Routes in `src/app.ts`. Storage behind the interface in `src/store/types.ts`.                                                                                                                                                                      |
| `services/api`         | One folder per concern: `routes/`, `access/`, `auth/`, `directory/`, `pricing/`, `jobs/`. The Fastify app is `app.ts`, the pool is `db.ts`.                                                                                                        |
| `apps/dashboard`       | Pages and `/api` routes in `src/app/`. Components in `src/components/common`, `layout` or `views`. Hooks in `src/hooks/`, plain helpers in `src/lib/`, constants and labels in `src/config/`. Mock API data in `src/mock/`.                        |
| `packages/testkit`     | Synthetic org and traffic generators in `src/`.                                                                                                                                                                                                    |
| `e2e`                  | `*.e2e.test.ts` against the compose stack.                                                                                                                                                                                                         |
| `db`                   | Migrations in `db/migrations/` through `pnpm db:new`. Role setup in `db/init/`.                                                                                                                                                                    |

Every package reads its environment in one file: `src/config.ts`. The
dashboard's is `src/config/server.ts`, because it must stay off the browser
bundle. Scripts read it in a `config.ts` next to them, like
`scripts/demo/config.ts`. Unit tests sit beside the code as `*.test.ts`. Tests that need
Postgres are `*.int.test.ts`.

### Boundaries

`pnpm lint:deps` runs dependency-cruiser with `.dependency-cruiser.mjs`. It
fails on:

- `packages/contracts` importing any other workspace. Both teams depend on
  it, so it must not depend on either of them.
- `apps/dashboard` importing a service, the collector or `e2e`. It talks to
  the backend over HTTP and parses with contracts.
- `packages/collector` importing `services/*` or `apps/*`. It ships to
  engineer laptops and only knows the wire format.
- `services/*` importing `apps/*`.
- `packages/testkit` imported from anything but a test file, `e2e` or
  testkit itself. Shipped code must not depend on synthetic data.
- Any import cycle.
- Any import it cannot resolve, since an unresolved import is an unchecked
  one.

### AGENTS.md rules in CI

`pnpm lint` (ESLint) fails on:

- `process.env` or `import { env } from 'node:process'` outside the config
  files above. Test files are exempt so a test can skip itself when its
  database is not configured.
- `console` outside scripts and tests.
- `randomUUID` in `packages/collector`, as an import or as a property.
- A hex, `rgb()` or `hsl()` color in a dashboard `.tsx` string.
  `src/components/layout/freshworks-logo.tsx` is exempt. It is brand artwork.

`pnpm lint:rules` (`scripts/lint_rules.py`) fails on:

- A TODO without a ticket, like `TODO(BE-2)`, in code, SQL, CSS or CI
  config. Prose in `docs/` is out of scope.
- A hex, `rgb()` or `hsl()` color in dashboard CSS. Dew's copied stylesheets
  in `public/dew` are exempt.

## Consequences

- A boundary break fails CI with the rule name and the import that broke it.
- One new dev dependency: dependency-cruiser. ESLint's built-in
  `no-restricted-imports` matches import strings, so it misses a relative path
  into another workspace and cannot see cycles. The import plugin that can is
  a second resolver to configure anyway.
- A new workspace gets a row in the table above, and a rule in
  `.dependency-cruiser.mjs` if it has a boundary.
- These checks cover the mechanical rules only. Reviewers still own the rest
  of AGENTS.md.
