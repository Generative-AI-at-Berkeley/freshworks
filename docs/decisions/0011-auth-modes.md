# 0011: Auth is OIDC in production, dev headers locally only

- Status: accepted
- Date: 2026-11-27
- Deciders: project leads

This records a decision the repo already follows. It is stated in
[api.md](../api.md#auth) and enforced by `services/api/src/config.ts`.

## Context

The query API is ours and identifies people with OIDC, as the spec describes
([ADR 0002](0002-ingest-through-freshworks-pipeline.md)). The dashboard and
the e2e tests have to run before the identity provider is wired up, and
without one on a laptop or in CI.

## Decision

- `API_AUTH_MODE=oidc` anywhere real. The bearer token comes from the
  corporate IdP and `sub` maps to `engineer.sso_subject`.
- `API_AUTH_MODE=local` reads `X-Dev-Engineer: <employee id>` and an optional
  `X-Dev-Roles: platform_admin`. Config refuses to load it unless `NODE_ENV`
  is `development` or `test`, or `API_ALLOW_HEADER_AUTH=true` is set
  explicitly (the compose demo, bound to localhost). An unknown `NODE_ENV`
  does not count as safe.
- `manager` is never assigned or claimed by header. It is derived from
  `manager_edge` on the date viewed.
- Auth runs in an encapsulated Fastify hook for every route under `/v1`. It
  is never gated on string checks against `request.url`.

## Consequences

- Local development, CI and the demo need no identity provider.
- A misconfigured production deploy fails at startup instead of trusting a
  header.
- OIDC verification is not built yet. `resolvePrincipal` returns no principal
  in `oidc` mode, so every `/v1` route answers 401 until BE-2 lands.
