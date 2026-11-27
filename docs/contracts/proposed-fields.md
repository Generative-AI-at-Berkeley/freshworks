# Proposed fields

Fields we need and the v2 pipeline does not carry. Owned by **AG-4**. Written
in the same shape as the Freshworks payload document so they can paste it
into theirs.

Until accepted, these travel under `ext.fwcoach` (the format reserves `ext`
for additions). Schema: `packages/contracts/src/proposed.ts`.

Status: **draft, not yet sent.**

## `source.ide`: new values

| Value          | Meaning                                  | Why                                             |
| -------------- | ---------------------------------------- | ----------------------------------------------- |
| `kiro`         | Amazon Kiro, IDE or CLI                  | Not covered today                               |
| `cursor-agent` | Cursor's command-line agent, not the IDE | Spec 6.2 reports IDE and agent as two harnesses |

## Subagent link (every event emitted inside a subagent run)

| Key                 | Type    | Notes                                        |
| ------------------- | ------- | -------------------------------------------- |
| `parent_session_id` | string  | The session that dispatched the subagent     |
| `is_subagent`       | boolean | `true` on events from inside a subagent run  |
| `subagent_id`       | string  | Stable per run, so its events group together |

## `credits` (events from harnesses that bill in credits)

| Key        | Type     | Example                | Notes                                      |
| ---------- | -------- | ---------------------- | ------------------------------------------ |
| `amount`   | number   | `1.25`                 | As reported. Never converted to tokens.    |
| `unit`     | string   | `credits`              | The harness's own unit                     |
| `source`   | string   | `kiro:session.json`    | Where the number was read                  |
| `spent_at` | RFC 3339 | `2026-10-07T11:40:26Z` | When it was consumed, not when it was read |

## TODO(AG-4)

- Fill in example events for each, in the doc's "full payload" style.
- Add anything AG-2 or AG-3 find they need while mapping formats.
- Send to Freshworks, record the date and their answer here.
