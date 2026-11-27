# Retention run

[ADR 0006](../decisions/0006-retention.md): raw events and session facts are
kept 13 months, then deleted. Daily rollups and other aggregates are kept.
Departed employees' detail is purged at offboarding regardless of age.

The period is `DETAIL_RETENTION_MONTHS` in `services/api/src/jobs/retention.ts`.
It is quoted in the collection notice, so changing one means changing both.

## Status

The job is wired but not built. `applyRetention` throws
`not implemented (BE-1)`, and so does the command below. The dry-run flag, the
event partitions and the `retention_run` table are all BE-1. The steps below
are the procedure BE-1 builds to.

## Run it

```sh
pnpm --filter @fwcoach/api job retention     # dev, reads the root .env
node dist/jobs/cli.js retention              # inside the API image
```

1. **Dry run.** Pass the dry-run flag (TODO(BE-1): name it in `jobs/cli.ts`).
   It lists the monthly `event` partitions and the `session_fact` rows it
   would delete, and drops nothing.
2. **Verify the list.**
   - Every partition is older than the cutoff: the start of the month 13
     months back.
   - Nothing on it is a rollup table (`request_rollup_daily`,
     `skill_usage_fact`). Those are kept.
   - `access_log` is not on it. It is not purged without a separate decision.
   - `ingest_msg` rows go with their partitions, plus a margin, so a late
     retry is still de-duplicated.
3. **Live run.** The same command without the flag.
4. **Check the audit row.**

```sql
select ran_at, dry_run, partitions_dropped, rows_purged
from app.retention_run
order by ran_at desc
limit 5;
```

Every run writes one `retention_run` row, dry runs included, so deletion is
auditable. A live run should match the dry run before it.

## If it goes wrong

- **The dry run lists a partition inside the window.** Stop. Check the clock on
  the host that ran it, and `DETAIL_RETENTION_MONTHS`.
- **A live run fails halfway.** Run it again. Dropping a partition is one
  statement, so each one is either gone or intact, and the job must be safe to
  re-run (`jobs/cli.ts`).
- **Data was dropped that should not have been.** Restore from a backup.
  Rollups are not rebuilt from raw events once those are gone.

## Departed employees

The purge at offboarding reads `engineer.departed_at` (BE-2). No ticket owns
the purge job yet. Raise it before relying on it.
