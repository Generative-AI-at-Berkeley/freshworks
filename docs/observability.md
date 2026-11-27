# Observability

What the backend emits, the targets we propose, and the alerts that watch
them. Everything is an open format: Prometheus text exposition for metrics,
JSON lines for logs. No vendor SDK, no hosted endpoint.

## Signals

### Logs

Every Fastify app (`services/api`, `services/ingest-mock`) and the collector
log JSON lines through pino. Each line from a request carries `reqId`.

Redaction is a backstop, not the rule. The rule is still to never hand the
logger a token, a request body or an event payload (AGENTS.md). The shared
list is `LOG_REDACT_PATHS` in `packages/contracts/src/observability.ts`. It
removes whole `headers` objects, `authorization`, `cookie`, the `X-Dev-*`
identity headers, tokens, credentials and anything under `body` or `payload`.
Tests in each `app.test.ts` and in `packages/collector/src/logger.test.ts`
send a bearer token and an event body and check neither reaches the output.

### Request IDs

The dashboard proxy (`apps/dashboard/src/app/api/v1/[...path]/route.ts`)
mints a UUID per call and sends it as `X-Request-ID`. It never reuses one from
the browser: AGENTS.md says no browser header is forwarded, and that includes
this one.

The API and ingest-mock take a valid inbound `X-Request-ID` (8 to 128
characters of `A-Z a-z 0-9 . _ -`) as Fastify's `reqId`. Anything else is
replaced with a fresh UUID, so a caller cannot write arbitrary text into log
lines. The ID comes back in the `X-Request-ID` response header and as
`requestId` in every `application/problem+json` body. The dashboard appends it
to the error message it shows, so a user can quote it and someone can find
the log line:

```sh
docker compose logs api | grep '"reqId":"<id>"'
```

A 5xx from the API answers with a generic sentence and the request ID. The
cause goes to the log only.

### Metrics

| Metric                                         | Type      | Where        | Labels                           |
| ---------------------------------------------- | --------- | ------------ | -------------------------------- |
| `http_server_request_duration_seconds`         | histogram | api, ingest  | `method`, `route`, `status_code` |
| `fwcoach_pg_pool_total_connections`            | gauge     | api          |                                  |
| `fwcoach_pg_pool_idle_connections`             | gauge     | api          |                                  |
| `fwcoach_pg_pool_waiting_clients`              | gauge     | api          |                                  |
| `fwcoach_ingest_records_total`                 | counter   | ingest       | `outcome`                        |
| `fwcoach_job_last_run_timestamp_seconds`       | gauge     | job textfile | `job_name`                       |
| `fwcoach_job_last_success_timestamp_seconds`   | gauge     | job textfile | `job_name`                       |
| `fwcoach_job_last_duration_seconds`            | gauge     | job textfile | `job_name`                       |
| `fwcoach_job_last_rows`                        | gauge     | job textfile | `job_name`                       |
| `fwcoach_job_failures_total`                   | counter   | job textfile | `job_name`                       |
| `fwcoach_job_data_through_timestamp_seconds`   | gauge     | job textfile | `job_name` (rollup only)         |
| `process_*`, `nodejs_*` (prom-client defaults) | various   | api, ingest  |                                  |

- The histogram's `_count` series is the request count. A separate counter
  would say the same thing.
- `route` is the route template (`/v1/engineers/:engineerId`), never the raw
  URL. Unmatched paths share the label `unmatched`, so a URL scan cannot add
  series.
- `outcome` is `accepted`, `duplicate` or `rejected`. Duplicates are retries
  the receiver already has, not failures.
- ingest-mock has no Postgres pool yet (BE-1), so only the API reports one.

Metrics come from [prom-client](https://github.com/siimon/prom-client).
It was picked over a hand-rolled registry because it is one small package
(two dependencies), gets the exposition format and escaping right, and adds
process and event loop metrics for free. A hand-rolled histogram would be
about as much code as the rest of this change.

### Where /metrics lives

Each service serves `/metrics` on its own listener, never on the public port:

| Service     | Variables                                    | Default          |
| ----------- | -------------------------------------------- | ---------------- |
| api         | `API_METRICS_HOST`, `API_METRICS_PORT`       | `127.0.0.1:9464` |
| ingest-mock | `INGEST_METRICS_HOST`, `INGEST_METRICS_PORT` | `127.0.0.1:9465` |

Localhost by default means a production deploy cannot expose it by accident.
Compose sets the host to `0.0.0.0` and does not publish the port, so only
Prometheus on the compose network reaches it. In production, bind it to the
interface your Prometheus scrapes and keep it out of the ingress.

### Job metrics

Jobs are one-shot processes (`services/api/src/jobs/cli.ts`) started by a
scheduler, so there is nothing to scrape while they run. `runJob` in
`jobs/run-job.ts` wraps each one and, when `JOB_METRICS_DIR` is set, writes
`fwcoach_job_<name>.prom` there for node_exporter's textfile collector. Each
run reads the previous file so the last success, its row count and the
failure count survive a failed run. A job that throws `not implemented` today
still records a failed run.

`data_through` is the end of the newest day the rollup has covered. It never
moves backwards when an old day is re-run.

### Tracing

Not built. OpenTelemetry tracing was scoped as optional, off by default, on
when `OTEL_EXPORTER_OTLP_ENDPOINT` is set. It was skipped because the weight
is out of proportion right now:

- Instrumenting `http`, Fastify and `pg` in an ESM service needs a loader hook
  started with `node --import`, which changes how every image and dev script
  starts.
- It is about seven `@opentelemetry/*` packages for two services whose routes
  mostly answer 501 and one mock.
- Request IDs already tie a dashboard error to the API log line, which is the
  question tracing would answer first.

Revisit when BE-2 and BE-3 land and requests do real work across the API and
Postgres.

## Targets (proposed)

**Every number here is proposed.** None is agreed with Freshworks or the
sponsor. Change them here and in `ops/alerts.yml` together.

| Target                     | Proposed                            | Measured by                                                              |
| -------------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| Data freshness             | `data_through` lag under 36h        | `time() - fwcoach_job_data_through_timestamp_seconds`                    |
| Ingest rejection rate      | under 1% of records, over 15m       | `rejected / (accepted + rejected)` from `fwcoach_ingest_records_total`   |
| Rollup last success age    | under 26h                           | `time() - fwcoach_job_last_success_timestamp_seconds{job_name="rollup"}` |
| Retention last success age | under 8 days                        | same, `job_name="retention"`                                             |
| API p95 latency            | under 500ms, over 5m                | `histogram_quantile(0.95, ...)` on the request histogram                 |
| API error rate             | under 1% 5xx, over 5m, 501 excluded | `status_code=~"5.."` share of the request histogram                      |

501 is excluded from the error rate because every route answers 501 until its
ticket lands. Drop the exclusion once BE-4 ships the last route.

The rejection rate leaves duplicates out of the denominator. They are retries
of records already counted, and a retry storm would dilute a real spike.

## Alerts

Rules are in [`ops/alerts.yml`](../ops/alerts.yml), with unit tests in
[`ops/alerts.test.yml`](../ops/alerts.test.yml). CI runs
`promtool check rules` and `promtool test rules` in the `alerts` job. Each
alert's `runbook_url` points at a section of
[runbooks/failure-modes.md](runbooks/failure-modes.md):

| Alert                        | Fires when                                | Runbook                                                              |
| ---------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| `FwcoachApiErrorRate`        | 5xx over 1% for 10m                       | [API error rate](runbooks/failure-modes.md#api-error-rate)           |
| `FwcoachApiLatencyP95`       | p95 over 500ms for 15m                    | [API latency](runbooks/failure-modes.md#api-latency)                 |
| `FwcoachPgPoolSaturated`     | queries waiting for a connection for 10m  | [Postgres pool](runbooks/failure-modes.md#postgres-pool-saturated)   |
| `FwcoachTargetDown`          | api or ingest-mock unscrapeable for 5m    | [Service down](runbooks/failure-modes.md#service-down)               |
| `FwcoachIngestRejectionRate` | rejections over 1% for 15m                | [Ingest rejections](runbooks/failure-modes.md#ingest-rejection-rate) |
| `FwcoachJobFailed`           | last run failed, or no run ever succeeded | [Job failed](runbooks/failure-modes.md#job-failed)                   |
| `FwcoachRollupStale`         | no rollup success for 26h                 | [Job not succeeding](runbooks/failure-modes.md#job-not-succeeding)   |
| `FwcoachRetentionStale`      | no retention success for 8 days           | [Job not succeeding](runbooks/failure-modes.md#job-not-succeeding)   |
| `FwcoachDataStale`           | `data_through` lag over 48h               | [Data stale](runbooks/failure-modes.md#data-stale)                   |

Routing (who gets paged for `severity: page`) is not set up. There is no
Alertmanager config in this repo.

## See it locally

The `observability` compose profile adds Prometheus, Grafana and a
node_exporter that only reads job metrics files. Plain `docker compose up` is
unchanged.

```sh
docker compose --profile observability up -d --build --wait
open http://localhost:3001     # Grafana, "fwcoach overview" dashboard, no login
open http://localhost:9090     # Prometheus, Status > Targets and Alerts
```

Ports taken? `GRAFANA_PORT=13001 PROMETHEUS_PORT=19090` before the command,
alongside the ones in [local-dev.md](runbooks/local-dev.md).

Without compose, run a service and curl its metrics port:

```sh
pnpm dev:api
curl localhost:9464/metrics
```

To see job metrics, point a job at the directory node_exporter reads. Today
both jobs fail with `not implemented`, which shows up as `FwcoachJobFailed`:

```sh
JOB_METRICS_DIR="$PWD/.job-metrics" pnpm --filter @fwcoach/api job rollup
```

Grafana and its datasource are provisioned from `ops/grafana/`. The dashboard
JSON is read only in the UI. Edit the file and restart Grafana.
