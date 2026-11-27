# Data model

Target schema. Each backend ticket writes the migrations for its own tables
and keeps its section of this doc in step: BE-1 ingestion, BE-2 identity,
org and audit, BE-3 facts and rollups, BE-4 price book. Starting point is spec 7.4, plus what the tickets and the
Freshworks answers added. Everything lives in the `app` schema.

```mermaid
erDiagram
  org_unit ||--o{ org_unit : parent
  org_unit ||--o{ engineer : department
  engineer ||--o{ manager_edge : reports
  engineer ||--o{ device : owns
  device ||--o{ event : sends
  ingest_batch ||--o{ event : contains
  ingest_msg ||--|| event : dedupes
  event }o--|| harness_dim : harness
  engineer ||--o{ session_fact : runs
  session_fact ||--o{ session_fact : "parent (subagent)"
  session_fact }o--|| model_dim : model
  engineer ||--o{ request_rollup_daily : ""
  engineer ||--o{ skill_usage_fact : ""
  skill_dim ||--o{ skill_usage_fact : ""
  engineer ||--o{ access_log : "viewed"
```

## Identity and org

| Table          | Key columns                                                                                                                                        | Notes                                                                                                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engineer`     | `employee_id` PK, `sso_subject`, `work_email`, `display_name`, `department_id`, `l2_consent_until`, `agent_version`, `last_seen_at`, `departed_at` | `sso_subject` maps OIDC `sub`. A directory export may lack it or a department ID. If so, `work_email` is the join key and a cost-center-like grouping stands in for department until confirmed. |
| `org_unit`     | `id` PK, `parent_id`, `name`, `type`                                                                                                               | Department tree.                                                                                                                                                                                |
| `manager_edge` | `engineer_id`, `manager_id`, `valid_from`, `valid_to` (null = current)                                                                             | Effective-dated. A reorg closes rows and opens new ones, never updates history. Exclusion constraint: no overlapping ranges per engineer. Leader rollups use a recursive CTE as of a date.      |
| `device`       | `device_id` PK, `engineer_id`, `first_seen_at`, `last_seen_at`                                                                                     | Filled from the credential mapping.                                                                                                                                                             |

## Ingestion

| Table          | Key columns                                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ingest_msg`   | `msg_id` PK, `received_at`                                                                                              | The de-duplication key. Unpartitioned on purpose: Postgres requires the partition key in every unique index on a partitioned table, so `event` alone could only be unique on `(msg_id, occurred_at)`. That breaks if a collector fix re-sends the same `msg_id` with a corrected timestamp. Pruned with the event partitions, plus a margin. |
| `event`        | `msg_id`, `occurred_at`, `device_id`, `engineer_id`, `harness`, `event_type`, `session_id`, `payload jsonb`, `batch_id` | Raw v2 events. Partitioned by month on `occurred_at`. A row is inserted only after its `msg_id` is claimed in `ingest_msg`. Kept 13 months.                                                                                                                                                                                                  |
| `ingest_batch` | `id` PK, `device_id`, `agent_version`, `received_at`, `accepted`, `duplicates`, `rejected`, `status`                    | One row per upload, for fleet health.                                                                                                                                                                                                                                                                                                        |

## Facts and rollups (built by BE-3 jobs)

| Table                  | Grain                            | Notes                                                                                                                                                                                                    |
| ---------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session_fact`         | one session                      | engineer, harness, repo name, start, end, request count, token totals, credit totals, `cost_usd` (nullable), `cost_source`, end reason, `parent_session_id`, `is_subagent`, `is_orphan`. Kept 13 months. |
| `request_rollup_daily` | engineer x day x harness x model | Counts, tokens by class, credits, cost and cost coverage, subagent share broken out. Kept indefinitely.                                                                                                  |
| `skill_usage_fact`     | engineer x skill x day           | Invocation count, `installed` flag so adoption is distinct from availability. Kept indefinitely.                                                                                                         |
| `antipattern_finding`  | engineer x rule x day            | Severity and count.                                                                                                                                                                                      |

## Dimensions and reference data

| Table         | Notes                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `harness_dim` | claude-code, cursor, cursor-agent, kiro.                                                                                                                       |
| `model_dim`   | Model IDs as reported, plus a normalised family.                                                                                                               |
| `skill_dim`   | De-duplicated by content hash plus ID. Carries the InstalledSkill fields.                                                                                      |
| `price_book`  | `kind` (token, credit, gpu), `key` (model, provider or deployment), `token_class`, `unit_price_usd`, `source`, `effective_from`, `effective_to`. See ADR 0005. |

## Audit

| Table        | Notes                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `access_log` | `viewer_id`, `subject_id`, `route`, `viewed_at`. Written in the same transaction as every individual-detail read. Readable by platform admins only. Not subject to the 13-month purge without a separate decision. |

## Access control in the database

Row-level security on every table with per-engineer rows. The API sets
`app.engineer_id` per transaction with `set local`. Policies allow a row when
it belongs to the caller, to someone in the caller's subtree as of the row's
date, or when the caller is a platform admin. The API role does not own the
tables, so RLS applies to it.
