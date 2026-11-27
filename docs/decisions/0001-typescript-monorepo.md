# 0001: TypeScript monorepo with shared Zod contracts

- Status: proposed, for review by both teams
- Date: 2026-11-26
- Deciders: project leads

## Context

The spec (7.1) leaves the API language to the team and recommends TypeScript:
the parsing core and the collector are TypeScript, so payload types and Zod
schemas can be shared between agent and server instead of written twice and
drifting. Go was the named alternative, for a single compiled agent binary.

Two teams build the two ends of one wire format at the same time. Drift
between them is the most likely integration failure.

## Decision

- TypeScript everywhere, Node 24 LTS (22 supported), ESM, strict mode.
- One pnpm workspace. `packages/contracts` defines the event shape once and
  both the collector and the services import it.
- Workspace packages export their source under the `@fwcoach/source`
  condition, so tests and dev servers need no prebuild, while `pnpm build`
  emits plain JS for Docker images.
- Fastify for HTTP, `pg` for Postgres with plain SQL, dbmate for migrations,
  Vitest for tests, pino for logs.

## Consequences

- A contract change shows up as a type error on both sides in the same PR.
- The collector ships as a Node app, not a single binary. The Jamf package has
  to carry a Node runtime or use a bundler that embeds one. Decide that in
  AG-1 before the rollout runbook is written.
- No ORM. SQL is written and reviewed as SQL, which suits a reporting system
  whose hard parts are recursive CTEs and row-level security.
