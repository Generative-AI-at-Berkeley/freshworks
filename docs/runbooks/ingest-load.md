# Ingest load test

`pnpm test:load` sends synthetic collector traffic at peak fleet rate to
ingest and fails when it misses a budget. Today the target is
`services/ingest-mock` in the compose stack, which keeps events in memory
until BE-1. Nobody owns performance in the tickets, so this is the baseline
to compare against when BE-1 lands Postgres storage.

## Run it

```sh
docker compose up -d --build --wait
pnpm test:load
docker compose down -v
```

Ports taken by another project? Remap them the way `pnpm demo` does and tell
the script where ingest is:

```sh
POSTGRES_PORT=55432 API_PORT=18080 INGEST_PORT=14318 docker compose up -d --build --wait
INGEST_PORT=14318 pnpm test:load
```

| Variable                | Default                 | What                                             |
| ----------------------- | ----------------------- | ------------------------------------------------ |
| `INGEST_URL`            | `http://localhost:4318` | Ingest base URL, same variable as the e2e suite  |
| `INGEST_PORT`           | 4318                    | Used to build the URL when `INGEST_URL` is unset |
| `LOAD_DURATION_SECONDS` | `durationSeconds` (60)  | Shorter runs while iterating                     |
| `LOAD_COUNT_CHECK`      | `compose-logs`          | `none` skips the stored-once check               |
| `LOAD_OUT_DIR`          | `load-results`          | Where `summary.json` goes                        |
| `LOAD_SEED`             | 1                       | Same seed, same mix of sizes and replays         |

CI runs it in `.github/workflows/load.yml`, weekly and on demand from the
Actions tab. It is not a required check. The results are the `load-results`
artifact on the run.

## The profile

Profile and budgets are in `scripts/load/load.config.json`.

| Number               | Value                              | Source                                                                                                                       |
| -------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Flush interval       | 300 s per device                   | `packages/collector/src/config.ts`, architecture.md                                                                          |
| Largest batch        | 500 events, 1 MB                   | `flushOnce` in `packages/collector/src/daemon.ts`                                                                            |
| Largest request body | 5 MiB                              | ingest-mock `bodyLimit`, a placeholder (ingest.md open question 3)                                                           |
| Devices              | 2,000                              | Assumption. No doc gives a fleet size                                                                                        |
| Peak factor          | 5x the steady rate                 | Assumption: laptops waking at 9am and flushing their backlog together                                                        |
| Batch sizes          | 70% 5 to 50, 25% 51 to 200, 5% 500 | Assumption, sized for the peak window: about 75 events per request, much more than a five minute flush holds on a normal day |
| Replays              | 5% of requests                     | Assumption. A collector retry resends the same batch with the same IDs (ingest.md)                                           |
| Bad records          | 1% of requests carry one           | Assumption. Same bad record as `e2e/ingest.e2e.test.ts`                                                                      |

That gives 2,000 / 300 x 5 = 33.3 requests a second for 60 seconds. Held
all day, that mix would be about 21,600 events per device. It is not meant
as a normal day: it models the burst after a night offline, when every
buffer is full. `flushOnce` skips the upload when the buffer is empty, so a
quiet device sends nothing. Events
are the v2 fixtures in `packages/contracts/fixtures` under fresh `eventId()`
IDs per run. Each device gets its own bearer token, the way the e2e suite
authenticates. Requests go out on a fixed schedule rather than waiting for
the previous answer, so a slow server shows up as latency, not as a lower
request rate. At most 64 are open at once.

When Freshworks shares real limits or BE-1 adds rate limits, change the
numbers in `load.config.json` and the table above in the same PR.

## Budgets

| Budget                 | Value  | Counts as a miss                                                      |
| ---------------------- | ------ | --------------------------------------------------------------------- |
| p95 latency            | 250 ms | All requests together                                                 |
| p99 latency            | 500 ms | All requests together                                                 |
| Valid batch error rate | 0      | Anything but a 200 with no `partialSuccess`, or a network error       |
| Bad records            | exact  | A batch with one bad record not answered with `rejectedLogRecords: 1` |
| Stored once            | exact  | Stored, duplicate and rejected counts differ from what was sent       |

The stored-once check sums the `batch stored` lines ingest-mock logs, read
with `docker compose logs`. That is the only view of its in-memory store.
Against a target whose logs you cannot read, set `LOAD_COUNT_CHECK=none`.
`TODO(BE-1)` in `scripts/load/main.ts` marks where it should count
`app.ingest_msg` and `app.event` rows instead.

## Read the results

The script prints one line per request kind and the record counts, then
`Within budget.` or `Over budget:` with one line per miss, and exits 1 on a
miss. `load-results/summary.json` has the same numbers plus the profile, the
achieved rate and `maxScheduleLagMs`.

- Achieved rate well under the target, or a large `maxScheduleLagMs`: the
  load generator fell behind or hit the 64 open requests cap. The latency
  numbers understate the problem. Look at the server first.
- p99 over budget, p95 fine: usually the 500 event batches. Compare the
  `valid` and `replay` lines; replays are full size but store nothing.
- Stored count high and duplicates low: replays were stored twice. That is a
  correctness bug in de-duplication, not a performance one.
- `failed ...` lines show the first 20 failures with their HTTP status.
  Check `docker compose logs ingest-mock`.

Measured on a MacBook against the compose stack, seed 1, 60 s: 2,000
requests at 33.3 req/s, p50 4.8 ms, p95 22.2 ms, p99 49.7 ms, max 163.6 ms,
no failures, 138,550 stored, 4,989 duplicates, 18 rejected, all matching.
