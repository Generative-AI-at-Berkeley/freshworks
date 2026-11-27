# Ingest rejection spike

Devices are uploading, but a growing share of their records is not stored.

**Never look at a payload.** Rejected records can be malformed in ways that
slipped past the collector's content policy. Do not turn on request body
logging, decode a `bytesValue` from a capture, or ask an engineer to send you
one. Work from counts, reasons, device IDs, agent versions and hashes.

## What fleet health shows

Planned, BE-4. `GET /v1/fleet/health` answers 501 today. When it lands it
shows agent versions and ingest failure rates (the BE-4 check in
`e2e/pipeline.e2e.test.ts`). It reads two tables BE-1 adds:

- `ingest_batch`: one row per upload with `accepted`, `duplicates`,
  `rejected` and `agent_version`.
- `ingest_rejection`: one row per record not stored, with `reason`
  (`invalid_schema`, `not_base64`, `too_large`) and `payload_sha256`. Never
  the payload.

A spike shows up as a rising failure rate, usually on one agent version.

## Find the reason today

ingest-mock writes one log line per upload. It holds the device ID and the
counts, never the token or the body.

```sh
docker compose logs ingest-mock | grep 'batch stored'
# "deviceId":"dev_...","inserted":0,"duplicates":1,"rejected":0,"msg":"batch stored"
```

Use `docker compose -p fwcoach-demo logs ingest-mock` for the demo stack.

`duplicates` is not a failure. It is a retry the receiver already has. Look at
`rejected`.

The reason per record goes back to the collector in the OTLP response, as
`partialSuccess.errorMessage` with one `record <n>: <error>` line each. The
errors come from `decodeBatch` in `packages/contracts/src/otlp.ts`:

| Error                           | Usual cause                                                      |
| ------------------------------- | ---------------------------------------------------------------- |
| `body.bytesValue is not base64` | Encoding bug in the uploader                                     |
| `body is not base64 JSON`       | Same, or a truncated record                                      |
| A Zod error with a field path   | The collector sends a shape `packages/contracts` does not accept |

Whole requests can also fail before any record is read: 401 without a bearer
token, 400 when the body is not OTLP, 413 over the body limit.

## Find the reason after BE-1

Planned. Run as the owner, since rejections are not per-engineer rows.

```sql
select reason, count(*)
from app.ingest_rejection
where received_at > now() - interval '1 hour'
group by reason
order by count(*) desc;

select b.agent_version, sum(b.rejected) as rejected, sum(b.accepted) as accepted
from app.ingest_batch b
where b.received_at > now() - interval '1 hour'
group by b.agent_version;
```

## What to do

- **One agent version.** The collector and the contract disagree. Reproduce
  with the fixtures in `packages/contracts/fixtures`, never a real payload.
  Fix the contract or the adapter, and ship a collector release.
- **One device.** Check its credential first
  ([device-credential.md](device-credential.md)), then its agent version.
- **Every device at once.** Suspect the receiver: a contracts change deployed
  without the collector, or a body limit change.

The collector acks rejected records and never resends them as they are
([docs/contracts/ingest.md](../contracts/ingest.md)). A spike does not block
uploads, but the rejected records are gone. Note the window in the incident.
