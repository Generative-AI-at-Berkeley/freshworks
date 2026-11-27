# 0009: Self-hosted Postgres, migrations with dbmate

- Status: accepted
- Date: 2026-11-27
- Deciders: project leads

This records a decision the repo already follows. It is stated in
[db/README.md](../../db/README.md), [architecture.md](../architecture.md) and
[ADR 0001](0001-typescript-monorepo.md).

## Context

The spec (7.1) asks for no managed abstraction over the database. The hard
parts of the backend are effective-dated reporting lines, recursive CTEs and
row-level security, which need plain Postgres and plain SQL. Raw events are
partitioned by month so retention is a partition drop
([ADR 0006](0006-retention.md)). ADR 0001 already chose `pg` with plain SQL
and no ORM.

## Decision

- PostgreSQL 18, self-hosted. Locally it runs in docker (`pnpm dev:infra`), in
  CI it is a `postgres:18-alpine` service container.
- The schema is plain SQL migrations in `db/migrations`, run by dbmate.
  dbmate is a pinned dev dependency, so `pnpm db:up` works after
  `pnpm install`.
- Everything lives in the `app` schema. Migrations run as the owner
  (`DATABASE_URL`). Services and integration tests connect as `fwcoach_api`
  (`APP_DATABASE_URL`), which does not own the tables, so row-level security
  applies to it.
- A merged migration is never edited. Every migration has a working
  `migrate:down`. CI applies all of them, rolls every one back and applies
  them again, and runs squawk on each `migrate:up`.

## Consequences

- No hosted database to provision for development, CI or the demo.
- No ORM or schema generator. Every schema change is reviewed as SQL, and
  docs/data-model.md changes in the same PR.
- Lock-heavy changes (a new index on `events`, a column rewrite) are caught by
  review and squawk, not by the tool. They need `create index concurrently`
  in a migration of their own with `transaction:false`.
