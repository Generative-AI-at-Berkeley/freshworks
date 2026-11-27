# Failure modes

What breaks, how it shows up, and what to do. Add a row when you learn a new
one. Only list behaviour the code has today; mark planned behaviour with its
ticket.

## Ingest

| Symptom                                                  | Cause                                                                                             | What to do                                                                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Collector gets 413                                       | The request body is over 5 MiB (`bodyLimit` in `services/ingest-mock/src/app.ts`).                | The collector should split batches. Check the batch size it sends.        |
| Response has `partialSuccess.rejectedLogRecords` above 0 | Some records failed decoding or the event schema. `errorMessage` lists each record index and why. | See [ingest-rejections.md](ingest-rejections.md). Never inspect payloads. |
| Collector gets 400                                       | The body is not an OTLP logs request at all.                                                      | Usually a collector bug or a wrong endpoint. Check the collector version. |
| Accepted events never reach the API                      | ingest-mock keeps events in memory today.                                                         | Expected until BE-1 stores them in Postgres.                              |

## API

| Symptom                   | Cause                                                                              | What to do                                        |
| ------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| A `/v1` route answers 501 | The route exists but its ticket has not landed. The problem body names the ticket. | Use the dashboard in mock mode until then.        |
| A route answers 401       | No caller identity. Locally that is a missing `X-Dev-Engineer` header.             | Add the header, see [local-dev.md](local-dev.md). |

## Dashboard

| Symptom                                                | Cause                                                        | What to do                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `/api/session` answers 503                             | Dashboard env vars are set but invalid. The body says which. | Fix the variable, or unset `API_BASE_URL` to use mock mode. |
| A page says the response "does not match the contract" | The API and `packages/contracts` disagree on a shape.        | Find which side changed. Contract changes need both teams.  |
| A page says it "could not reach the dashboard server"  | The Next.js server is down.                                  | Restart `pnpm dev:dashboard`.                               |

## Demo

| Symptom                               | Cause                                         | What to do                                                                                  |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm demo` stops with a port message | Another stack holds 5432, 4318, 8080 or 3000. | Set `POSTGRES_PORT`, `INGEST_PORT`, `API_PORT` or `DASHBOARD_PORT`. See [demo.md](demo.md). |

## Alerts

The sections below are the targets of the alerts in `ops/alerts.yml`
([observability.md](../observability.md#alerts)). Thresholds are proposed.

Never look at a payload while working any of these. Work from counts,
statuses, request IDs and logs, which carry none
([ingest-rejections.md](ingest-rejections.md)).

## API error rate

`FwcoachApiErrorRate`: more than 1% of API requests answered 5xx (501 aside)
for 10 minutes.

1. Find the route. In Prometheus:
   `sum by (route, status_code) (rate(http_server_request_duration_seconds_count{job="api",status_code=~"5.."}[5m]))`
2. Pull a few failing request IDs from the logs and read the error each one
   logged: `docker compose logs api | grep '"msg":"request failed"'`.
3. A 503 from `/readyz` or errors on every route usually means Postgres. Check
   [Postgres pool saturated](#postgres-pool-saturated) and that Postgres is up.
4. One route only: a bug in that route. Roll back the last API deploy if it
   started with it.

A user reporting an error from the dashboard quotes a request ID. Grep for it:
`docker compose logs api | grep '"reqId":"<id>"'`.

## API latency

`FwcoachApiLatencyP95`: p95 over 500ms for 15 minutes.

1. Split by route: the "API p95 latency by route" panel in Grafana.
2. Check [Postgres pool saturated](#postgres-pool-saturated). Waiting for a
   connection shows up as latency before it shows up as errors.
3. One route: look for a missing index or a query that grew with the data.
   `explain analyze` it as the service user, not the owner, so row-level
   security applies the same way.

## Postgres pool saturated

`FwcoachPgPoolSaturated`: queries waited for a free connection for 10 minutes.
The pool is 10 connections per API process (`services/api/src/db.ts`).

1. Is traffic up? Compare request rate to last week.
2. Are connections held? `fwcoach_pg_pool_idle_connections` at 0 with low
   traffic means something holds a connection, usually a slow query or a
   transaction left open. Look at `pg_stat_activity` for long-running
   `idle in transaction` sessions.
3. More API replicas spread load, but check Postgres `max_connections` first.

## Service down

`FwcoachTargetDown`: Prometheus could not scrape api or ingest-mock for 5
minutes.

1. Is the process up? `docker compose ps`, then `docker compose logs <service>`.
2. Up but unscrapeable: the metrics listener is on its own port (9464 for the
   API, 9465 for ingest-mock). Check `API_METRICS_HOST` or
   `INGEST_METRICS_HOST`. The default `127.0.0.1` cannot be reached from
   another container.
3. A config error at start prints `Invalid API config` or
   `Invalid ingest config` with the variable at fault.

## Ingest rejection rate

`FwcoachIngestRejectionRate`: more than 1% of new records rejected for 15
minutes. Duplicates are not counted: they are retries.

Follow [ingest-rejections.md](ingest-rejections.md). The "Ingest records by
outcome" panel shows when it started. Whole requests answered 401, 400 or 413
show in "Ingest requests by status", not in this rate.

## Job failed

`FwcoachJobFailed`: the last run of a job failed, or none has ever succeeded.

1. Read the job's output from the scheduler. `runJob` rethrows, so the
   process exits non-zero with the error.
2. Re-run it. Jobs are safe to re-run (`jobs/cli.ts`):
   `node dist/jobs/cli.js rollup <day>` or `... retention`.
3. Until BE-3 and BE-1 land, both jobs throw `not implemented`, so this alert
   fires wherever they are scheduled. Do not schedule them yet.

## Job not succeeding

`FwcoachRollupStale` (no success for 26h) or `FwcoachRetentionStale` (8
days). Same steps as [Job failed](#job-failed), plus:

- No failures either: the scheduler is not starting the job, or
  `JOB_METRICS_DIR` changed and node_exporter reads a different directory.
  `fwcoach_job_last_run_timestamp_seconds` shows when it last ran at all.
- Retention behind by a few days is not urgent. Detail past 13 months is kept
  a little longer. Note it if it runs past the period quoted in the collection
  notice ([retention.md](retention.md)).

## Data stale

`FwcoachDataStale`: the newest rolled-up day ended more than 48h ago, so the
dashboards' "data through" date is behind.

1. Check [Job not succeeding](#job-not-succeeding) first. A stale rollup is
   the usual cause.
2. Rollup succeeds but the lag grows: it is running an old day, not
   yesterday. With no date argument `jobs/cli.ts` rolls up yesterday in UTC.
   Check the scheduler passes no date, or the right one.
3. Backfill each missing day in order. Rollup replaces a day's rows, so
   repeating a day is harmless.
