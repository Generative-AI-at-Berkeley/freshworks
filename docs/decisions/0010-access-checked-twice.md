# 0010: Access to an individual is checked twice

- Status: accepted
- Date: 2026-11-27
- Deciders: project leads

This records a decision the repo already follows. It is stated in
[AGENTS.md](../../AGENTS.md) (Backend), [architecture.md](../architecture.md)
and [data-model.md](../data-model.md#access-control-in-the-database).

## Context

The system holds per-engineer usage. The spec (7.5, 8) allows an engineer's
data to the engineer, their management chain as of the date viewed, and
platform admins. Never sideways, never org-wide. One missed check in one
route would leak someone's data, and routes are written by several people
across tickets.

## Decision

- Every route that reads an individual checks `AccessPolicy`
  (`services/api/src/access/policy.ts`) before reading.
- Postgres row-level security enforces the same rule on every table with
  per-engineer rows. The API sets `app.engineer_id` and `app.roles` per
  transaction with `set local`, through `withCaller` in
  `services/api/src/db.ts`.
- The rule lives in one SQL function, `app.reports_to(viewer, subject, as_of)`,
  used by both the policies and `AccessPolicy`, so the two checks cannot
  disagree. Tables opt in with `app.protect(table, engineer_column,
date_column)`, which enables and forces RLS.
- Every allowed view of an individual writes `access_log` in the same
  transaction as the read.

## Consequences

- A route that forgets the check still gets no rows it should not see.
- Every per-engineer table must call `app.protect()`. A table that does not is
  only protected by the route check.
- Services must never connect as the table owner, which bypasses RLS
  ([ADR 0009](0009-self-hosted-postgres-dbmate.md)).
- BE-2 ships `app.reports_to()`, `app.protect()` and `AccessPolicy` first.
  Until then the interface exists and the individual routes return 501.
