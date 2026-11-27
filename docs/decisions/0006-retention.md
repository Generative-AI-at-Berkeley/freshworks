# 0006: Retention: 13 months of detail, summaries kept

- Status: accepted (period to be confirmed and published by Freshworks)
- Date: 2026-11-26
- Deciders: project leads; Freshworks privacy review to confirm

## Context

The spec suggests 13 months of detail and indefinite aggregates, with
automated deletion and purge of departed employees' detail on the normal
offboarding cycle. The period has to be agreed and published in the
install-time notice.

## Decision

- Raw events and per-session facts: 13 months, then deleted.
- Daily rollups and other aggregates: kept.
- Departed employees: detail purged at offboarding regardless of age.
- Raw events are partitioned by month on `occurred_at`, so deletion is a
  partition drop, run by a scheduled job with a dry-run mode.

## Consequences

- Year-over-year comparisons work at aggregate level only.
- The period is a constant in one place (`DETAIL_RETENTION_MONTHS`) and
  quoted in the collection notice. Changing it changes both.
