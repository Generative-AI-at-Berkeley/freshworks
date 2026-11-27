# Query API

`services/api`. Read-only paths for dashboards, from spec 7.5. Ingestion is
not here (ADR 0002). Routes are registered in `src/routes/v1.ts` and return
501 until their ticket lands.

The OpenAPI 3.1 document is [openapi.json](openapi.json). It is generated from
the Zod schemas in `packages/contracts/src/api` by `pnpm gen:openapi`, and CI
fails if the committed copy is stale. Routes still waiting on a ticket are
marked `x-status: draft`.

## Auth

| Mode    | How the caller is identified                                               | Where                                                                                                                                            |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oidc`  | Bearer token from the corporate IdP. `sub` maps to `engineer.sso_subject`. | Anywhere real. TODO(BE-2).                                                                                                                       |
| `local` | `X-Dev-Engineer: <employee id>`, optional `X-Dev-Roles: platform_admin`    | Only when `NODE_ENV` is `development` or `test`, or with `API_ALLOW_HEADER_AUTH=true` (the compose demo, bound to localhost). Refused otherwise. |

An unset `NODE_ENV` counts as `production`. `local` is refused in production
whatever `API_ALLOW_HEADER_AUTH` says, and the API exits at startup with the reason.

Roles: `engineer` (everyone), `manager` (derived from `manager_edge` on the
date viewed, never assigned and never claimable by header), `platform_admin`.

Routes live in an encapsulated Fastify plugin under the `/v1` prefix. Its
auth hook runs for every route the router matches there and sets
`request.principal`. Never gate auth on string checks against `request.url`.
Data reads go through `withCaller` in `src/db.ts`.

## Routes

| Route                                       | Who can call it                                                        | Ticket |
| ------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| `GET /v1/me/data`                           | Anyone, for themselves. Includes the raw rows behind their numbers.    | BE-2   |
| `GET /v1/org/{orgUnitId}/overview`          | Managers of that unit, admins                                          | BE-3   |
| `GET /v1/leaders/{managerId}/rollup?depth=` | That manager and their chain, admins                                   | BE-3   |
| `GET /v1/engineers/{engineerId}`            | The engineer, their chain as of the date, admins. Writes `access_log`. | BE-2   |
| `GET /v1/admin/access-log`                  | Admins                                                                 | BE-2   |
| `GET /v1/skills/adoption`                   | Managers (scoped to subtree), admins                                   | BE-3   |
| `GET /v1/fleet/health`                      | Admins                                                                 | BE-4   |
| `GET /healthz`, `GET /readyz`               | Anyone. Liveness, and readiness including Postgres.                    | done   |

## Conventions

- Errors are `application/problem+json` (RFC 9457):
  `{ "type": "about:blank", "title": "Forbidden", "status": 403, "detail": "...", "requestId": "..." }`.
  `requestId` matches the `X-Request-ID` response header and the API's log line
  ([observability.md](observability.md#request-ids)).
  `detail` says what broke and what to do. Build bodies with `api.problem()`
  from `packages/contracts`. Unknown routes are a 404 problem. A 5xx never
  carries the underlying error message; that goes to the log.
- Limits (all in `src/config.ts`, `API_*` variables): 64 KiB bodies, 30s to
  receive a request, and 600 requests per caller per minute under `/v1` (429
  with `Retry-After`). The rate limit counts in memory, per instance. Move it
  to a shared store before running more than one instance.
- No CORS: only the dashboard's server calls the API. Helmet sets nosniff,
  `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer`. HSTS only with
  `API_HSTS=true`, for when TLS terminates in front of the API.
- Dates are UTC days as `YYYY-MM-DD`. Ranges are `from` inclusive, `to` exclusive.
- Every cost comes with its coverage: `{ "costUsd": 1234.5, "costCoverage": 0.82 }`.
  `costUsd` is `null` when nothing could be priced.
- Any route that returns a cost accepts `?explain=true`, which adds the
  `price_book` rows used and the usage each one priced. Line items sum to the total.
- Every total carries its coverage: how much of the underlying data was
  actually measured, so a gap never reads as zero.
- No endpoint returns people ordered by volume. Distributions, not rankings.
- Unknown is `null`, never `0`.

TODO(BE-2, BE-3, BE-4): add request and response examples for each route as it lands.
