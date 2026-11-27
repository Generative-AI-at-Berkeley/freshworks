# Query API

`services/api`. Read-only paths for dashboards, from spec 7.5. Ingestion is
not here (ADR 0002). Routes are registered in `src/routes/v1.ts` and return
501 until their ticket lands.

## Auth

| Mode    | How the caller is identified                                               | Where                                                                                                                                            |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `oidc`  | Bearer token from the corporate IdP. `sub` maps to `engineer.sso_subject`. | Anywhere real. TODO(BE-4).                                                                                                                       |
| `local` | `X-Dev-Engineer: <employee id>`, optional `X-Dev-Roles: platform_admin`    | Only when `NODE_ENV` is `development` or `test`, or with `API_ALLOW_HEADER_AUTH=true` (the compose demo, bound to localhost). Refused otherwise. |

Roles: `engineer` (everyone), `manager` (derived from `manager_edge` on the
date viewed, never assigned and never claimable by header), `platform_admin`.

Routes live in an encapsulated Fastify plugin under the `/v1` prefix. Its
auth hook runs for every route the router matches there and sets
`request.principal`. Never gate auth on string checks against `request.url`.
Data reads go through `withCaller` in `src/db.ts`.

## Routes

| Route                                       | Who can call it                                                        | Ticket |
| ------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| `GET /v1/me/data`                           | Anyone, for themselves. Includes the raw rows behind their numbers.    | BE-4   |
| `GET /v1/org/{orgUnitId}/overview`          | Managers of that unit, admins                                          | BE-3   |
| `GET /v1/leaders/{managerId}/rollup?depth=` | That manager and their chain, admins                                   | BE-3   |
| `GET /v1/engineers/{engineerId}`            | The engineer, their chain as of the date, admins. Writes `access_log`. | BE-4   |
| `GET /v1/admin/access-log`                  | Admins                                                                 | BE-4   |
| `GET /v1/skills/adoption`                   | Managers (scoped to subtree), admins                                   | BE-3   |
| `GET /v1/fleet/health`                      | Admins                                                                 | BE-3   |
| `GET /healthz`, `GET /readyz`               | Anyone. Liveness, and readiness including Postgres.                    | done   |

## Conventions

- Errors are `application/problem+json`: `{ "status": 403, "detail": "..." }`.
  `detail` says what broke and what to do.
- Dates are UTC days as `YYYY-MM-DD`. Ranges are `from` inclusive, `to` exclusive.
- Every cost comes with its coverage: `{ "costUsd": 1234.5, "costCoverage": 0.82 }`.
  `costUsd` is `null` when nothing could be priced.
- No endpoint returns people ordered by volume. Distributions, not rankings.
- Unknown is `null`, never `0`.

TODO(BE-3, BE-4): add request and response examples for each route as it lands.
