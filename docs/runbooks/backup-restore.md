# Backup and restore

Logical backups with `pg_dump` in custom format, restored with `pg_restore`.
CI runs the whole procedure on every PR (the `db` job: back up a migrated
database, restore it into a new one, compare), so the scripts here are known
to work against the current migrations.

## Status

The scripts are ready. Schedule, storage and point-in-time recovery depend on
where production Postgres is hosted, which is not decided. Those parts are
proposals and say so.

## What to back up

- **The `fwcoach` database, whole.** That is the `app` schema and
  `public.schema_migrations`, which tells dbmate what is applied. Raw events
  past retention and `access_log` exist nowhere else.
- **Not in the dump: roles.** Roles are cluster-wide, so `pg_dump` skips
  `fwcoach_app`, the login users, their passwords and their role-level
  timeouts. On a new server, create them before restoring:

  ```sql
  create role fwcoach_app nologin nosuperuser nobypassrls;
  -- then each service login user, with its password from the secret store
  grant fwcoach_app to <service user>;
  ```

  Then run the three `alter role` lines from
  `db/migrations/20261127000100_app_role_timeouts.sql` for each login user.
  `pg_dumpall --roles-only` captures all of this too, but its output holds
  password hashes, so store it like a secret.

## How often (proposal)

- Nightly `scripts/db/backup.sh`, plus one before every production migration.
- Keep nightly dumps for 35 days. Retention ([ADR 0006](../decisions/0006-retention.md))
  only means something if backups do not keep deleted detail for long, so
  backups must not outlive the purge by much. Longer backup retention needs
  the privacy review to agree.
- Store dumps encrypted, off the database host, readable by platform admins
  only. A dump holds every row, including `access_log`.
- Test a restore monthly with the steps below.

## Back up

```sh
export DATABASE_URL=...         # owner URL. The scripts never print it.
scripts/db/backup.sh            # writes fwcoach-<UTC time>.dump here
scripts/db/backup.sh /path/to/name.dump
```

It writes to `<name>.partial` and renames only after `pg_restore --list`
reads the file back, so a file without `.partial` is a complete dump. It
refuses to overwrite an existing file. `*.dump` is gitignored. Never commit
one.

`pg_dump` must be the server's major version or newer. If yours is older,
run the scripts in the server's image:

```sh
docker run --rm --network host -v "$PWD:/w" -w /w -e DATABASE_URL \
  postgres:18-alpine sh scripts/db/backup.sh
```

## Restore into a scratch database

Restore into a new database first, always, even when the plan is to replace
production. It proves the dump is good before anything is dropped.

```sh
psql "$DATABASE_URL" -c 'create database fwcoach_restore'
export SOURCE_DATABASE_URL="$DATABASE_URL"
export DATABASE_URL=...         # the same server, database fwcoach_restore
scripts/db/restore.sh fwcoach-20261127T020000Z.dump
scripts/db/compare.sh
```

- `restore.sh` refuses a database that already has an `app` schema, and
  checks `fwcoach_app` exists. It restores in one transaction, so a failure
  leaves the database empty.
- `compare.sh` diffs the schema and grants, then exact row counts per table,
  and exits 1 on any difference. Against a live source the counts will be
  higher on the source side by what was written after the backup. Check each
  table is the same or a little higher, never lower.
- The restored database is owned by whoever ran the restore (`--no-owner`).
  Services stay non-owners through `fwcoach_app`, so row-level security still
  applies to them.

To recover a few rows (a partition dropped by mistake, see
[retention.md](retention.md)), copy them from `fwcoach_restore` into the live
database with `insert ... select` over `dblink` or a `\copy` round trip, then
drop `fwcoach_restore`.

## Replace production from a backup

Only after a scratch restore compares clean.

1. Stop the API, ingest and jobs, so nothing writes.
2. Take one more backup of the current state, even if it is broken.
3. `drop database fwcoach` and `create database fwcoach`, then `restore.sh`
   into it.
4. Run `pnpm db:up`. It applies any migration newer than the dump.
5. Run the retention job and the departed-employee purge before letting
   anyone read. An old dump brings back detail deleted since it was taken.
6. Start the services.

## Point-in-time recovery (hosting decision)

A nightly dump loses up to a day of writes. Recovering to a given minute needs
WAL archiving (a base backup plus continuous WAL, with pgBackRest, WAL-G, or a
managed provider's PITR). That is set up where Postgres is hosted, not in this
repo. Whoever decides hosting decides this too, and records it in an ADR.
Until then, the RPO is the time since the last dump.
