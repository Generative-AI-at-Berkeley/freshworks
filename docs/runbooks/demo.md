# Demo

One command brings up the whole stack on synthetic data. Nothing here touches
a real person or a real endpoint.

```sh
pnpm install
pnpm demo                  # prints the dashboard URL when it is ready
pnpm demo:down             # stops it and deletes its database volume
```

Needs Docker and the setup from [local-dev.md](local-dev.md). The first run
builds three images and takes a few minutes. Later runs reuse them.

## What it does

`scripts/demo/main.ts`, in order:

1. `docker compose up -d --build --wait`: Postgres, the `migrate` one-shot
   (dbmate), ingest-mock and the API.
2. Prints the migration count and the tables in the `app` schema.
3. Generates the synthetic org with `generateOrg` from `packages/testkit`.
4. Generates a day of traffic with `generateDay` and posts it to ingest-mock's
   `/v1/logs`, one OTLP request per synthetic device, under that device's token.
5. Runs the rollup job for yesterday (UTC) inside the API container.
6. Calls the four API routes the dashboard reads.
7. Starts the dashboard container. It uses API mode when every route in step 6
   answers. Otherwise it uses mock mode, which serves the built-in org in
   `apps/dashboard/src/mock`. The script asks the dashboard's `/api/session`
   which mode it is in and prints it.

A step that waits on an unfinished ticket prints `degraded (<ticket>)` and the
demo carries on. The summary at the end lists every one.

The demo runs as its own compose project, `fwcoach-demo`. `pnpm demo:down`
deletes that project's volume, not the one your `docker compose up` dev stack
uses. Both use the same ports, so stop one before starting the other.

Running `pnpm demo` twice is safe. Compose recreates only what changed, and
ingest-mock stores a replayed `msg_id` once.

## What is degraded today

| Step              | Today                                                                  | Waiting on |
| ----------------- | ---------------------------------------------------------------------- | ---------- |
| Schema            | Baseline migration only. No tables in `app` yet.                       | BE-1, BE-2 |
| Synthetic org     | `generateOrg` throws, so there is nobody to seed.                      | BE-2       |
| Loading the org   | No directory loader writes it to Postgres. `TODO(BE-2)` in the script. | BE-2       |
| Traffic replay    | Skipped without the org. `generateDay` also throws.                    | BE-2, AG-1 |
| Where events land | ingest-mock keeps them in memory, so the API cannot read them.         | BE-1       |
| Rollup job        | `rollupDay` throws.                                                    | BE-3       |
| API routes        | All four answer 501.                                                   | BE-2, BE-3 |
| Dashboard         | Mock mode.                                                             | the above  |

When a ticket lands, the matching step starts working without a change to the
script, except loading the org, which needs the `TODO(BE-2)` filled in.

## Ports

| Variable         | Default | What               |
| ---------------- | ------- | ------------------ |
| `POSTGRES_PORT`  | 5432    | Postgres           |
| `INGEST_PORT`    | 4318    | ingest-mock        |
| `API_PORT`       | 8080    | query API          |
| `DASHBOARD_PORT` | 3000    | dashboard          |
| `DEMO_SEED`      | 1       | synthetic data RNG |

```sh
POSTGRES_PORT=55432 API_PORT=18080 INGEST_PORT=14318 DASHBOARD_PORT=13000 pnpm demo
```

## The dashboard container on its own

`apps/dashboard/Dockerfile` builds Next's standalone output. The compose
service sits behind the `dashboard` profile, so a plain `docker compose up`
and CI's e2e job do not start it.

```sh
docker compose --profile dashboard up -d --build --wait dashboard
```

With no other variables set it runs in mock mode. For API mode, set
`DASHBOARD_API_BASE_URL=http://api:8080`, `DASHBOARD_DEV_ENGINEER` and
`DASHBOARD_DEV_ORG_UNIT`.

## Common problems

- **`port is already allocated`.** Something else has that port, often the
  dev stack. Run `docker compose down`, or set the port variables above.
- **`Docker is not running`.** Start Docker and run `pnpm demo` again.
- **The dashboard reports a different mode than expected.** Read
  `docker compose -p fwcoach-demo logs dashboard`. A config error there names
  the variable to fix.
