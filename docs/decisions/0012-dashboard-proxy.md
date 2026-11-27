# 0012: The dashboard talks only to its own proxy

- Status: accepted
- Date: 2026-11-27
- Deciders: project leads

This records a decision the repo already follows. It is stated in
[AGENTS.md](../../AGENTS.md) (Dashboard) and implemented in
`apps/dashboard/src/app/api/v1/[...path]/route.ts`.

## Context

In local auth mode the API trusts `X-Dev-Engineer`
([ADR 0011](0011-auth-modes.md)). A browser that
could reach the API directly, or whose headers were passed through, could
claim to be anyone. The API address and the dev identity are configuration
that should not be bundled for the client.

## Decision

- The browser calls only the dashboard's own `/api` routes. The `/api/v1`
  route proxies to the query API.
- The proxy adds identity server side, from `apps/dashboard/src/config/server.ts`.
  It never forwards a header the browser sent.
- The proxy refuses path segments that are empty, `.`, `..` or contain `/`,
  so a request cannot be steered to another API path.
- The dev identity is refused when `NODE_ENV=production` unless
  `DASHBOARD_ALLOW_DEV_IDENTITY=true`, which mirrors `API_ALLOW_HEADER_AUTH`
  for the compose demo.
- With no `API_BASE_URL` the proxy answers from built-in mock data, so the
  dashboard runs without a backend.
- Every response is parsed with its schema from `packages/contracts`.

## Consequences

- The browser never holds the API address or an identity it could change.
- OIDC sign-in replaces the dev identity in the proxy. That lands in X-3,
  after BE-2.
- Every API call takes one extra hop through the Next server.
