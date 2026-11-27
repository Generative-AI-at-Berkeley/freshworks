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
