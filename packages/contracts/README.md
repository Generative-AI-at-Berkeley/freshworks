# @fwcoach/contracts

The wire contract between the collector (`packages/collector`) and anything that
receives its events (`services/ingest-mock` now, the Freshworks telemetry
pipeline later). Owned by ticket **X-1**.

What lives here:

| File                 | What it is                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `src/event.ts`       | The v2 event: the blocks every event carries (`source`, `device`, ...).    |
| `src/events/*.ts`    | The `data` object for each `event_type`.                                   |
| `src/envelope.ts`    | The delivery message wrapped around each event (`msg_id`, `payload`, ...). |
| `src/otlp.ts`        | Encoding a batch as an OTLP JSON logs request, and decoding it back.       |
| `src/ids.ts`         | Deterministic event IDs, which is what makes retries safe.                 |
| `src/proposed.ts`    | Fields we want Freshworks to add. Not accepted yet. See below.             |
| `fixtures/v2/*.json` | One synthetic example per event type. Tests on both sides load these.      |

## Rules

- The source of the format is the v2 payload document Freshworks shared on
  Slack. That document is not in this repo. When it changes, update the schema
  and the fixtures in the same PR, and say which revision you matched in the PR
  description.
- The shared blocks (`source`, `device`, `session`, `model`, `repo`) are
  `strictObject`: an unknown key is an error, not silently dropped. `pdlc`
  and `ext` pass extra keys through. `data` is permissive for event types we
  have not modelled yet (`unmodelledData`). Tighten
  one event type at a time, each with its fixture.
- Fixtures are synthetic. No real device IDs, repo names, internal plugin or
  command names, or anything copied from a real session. `fixtures.test.ts`
  checks that every fixture parses.
- A missing key means "not measured". `0` means "measured as zero". Never fill a
  gap with `0` to make a schema pass. The cost and coverage numbers depend on
  this distinction.

## Proposed fields

`src/proposed.ts` holds what we need and the pipeline does not carry yet
(subagent links, Kiro, credits). Until Freshworks accepts them they travel
under `ext.fwcoach`, which the format reserves for additions. When they are
accepted, move them to their final place and delete the `ext` copy.
