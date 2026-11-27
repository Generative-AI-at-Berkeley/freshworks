# Database

PostgreSQL 18, self-hosted (spec 7.1: no managed abstraction). Migrations are
plain SQL run by [dbmate](https://github.com/amacneil/dbmate), which is a dev
dependency, so `pnpm db:up` works after `pnpm install`.

```sh
pnpm dev:infra          # start Postgres in docker
cp .env.example .env    # dbmate reads DATABASE_URL from .env
pnpm db:up              # apply pending migrations
pnpm db:new add_engineer_table
pnpm db:down            # roll back the latest one
```

## Rules

- **Never edit a merged migration.** Add a new one. Merged migrations have run
  on someone's database, and dbmate will not run an edited one again.
- **Every migration has a working `migrate:down`.** CI applies all migrations,
  rolls every one back, and applies them again. A down that does not undo its
  up fails the build.
- **One concern per migration.** A table and its indexes together is fine. Two
  unrelated tables is two migrations, so one can be reverted alone.
- **Everything goes in the `app` schema.** Use `app.` explicitly in DDL.
- **Services never connect as the owner.** The owner bypasses row-level
  security. Migrations run as the owner (`DATABASE_URL`); services and
  integration tests use the `fwcoach_api` user (`APP_DATABASE_URL`), a member
  of `fwcoach_app`, which the baseline grants table access by default.
- **Enable RLS on every per-engineer table**, with `force row level security`
  as well, so the policy holds even if someone later connects as the owner.
- **Expensive changes are flagged in the PR.** A new index on a large table,
  a column rewrite, or a lock on `events` needs a note saying how long it
  holds the lock, or `create index concurrently` in its own migration (dbmate:
  add `-- migrate:up transaction:false`). CI runs
  [squawk](https://squawkhq.com) on every `migrate:up` section to catch the
  common ones. Run it locally with `pnpm lint:migrations`.
- **Data model changes update docs/data-model.md in the same PR.**
- **Audit tables call `app.append_only(table)`** in the migration that creates
  them. See [docs/data-model.md](../docs/data-model.md#append-only-tables).

## Changing a table that is in use

Services keep running while a migration applies, and the previous release
keeps running until the new one is rolled out. So every migration has to work
with both the old code and the new code. A rename or a type change done in one
step breaks whichever side does not expect it. Split it into expand and
contract, each step its own PR and release:

1. **Add.** Add the new column, nullable or with a constant default (both are
   instant on Postgres 11+). Nothing reads it yet.
2. **Backfill.** Copy old values into it in batches, from a job or a
   `transaction:false` migration, so no single statement locks the table for
   long. New code writes both columns from here on.
3. **Switch.** Release code that reads the new column. Add `not null` once
   the backfill is done, through a `check (...) not valid` constraint and a
   separate `validate constraint`, so the full scan does not block writes.
4. **Remove.** Once no running release reads the old column, drop it in a
   later migration.

Renaming `engineer.display_name` to `engineer.name`, for example:

```sql
-- PR 1, add
alter table app.engineer add column name text;

-- PR 2, backfill (repeat until it updates 0 rows)
update app.engineer set name = display_name
where id in (select id from app.engineer where name is null limit 1000);

-- PR 3, switch: code reads name, then
alter table app.engineer add constraint engineer_name_not_null
  check (name is not null) not valid;
alter table app.engineer validate constraint engineer_name_not_null;

-- PR 4, remove
alter table app.engineer drop column display_name;
```

Each step has a working `migrate:down` like any other migration. The down for
step 4 cannot bring the data back, so take a backup first
([backup-restore.md](../docs/runbooks/backup-restore.md)).

### Indexes on tables with data

`create index` blocks writes to the table until it finishes. On a table that
takes live writes (`event`, `access_log`, rollups), use
`create index concurrently` in a migration of its own:

```sql
-- migrate:up transaction:false
create index concurrently if not exists event_engineer_idx
  on app.event (engineer_id, occurred_at);

-- migrate:down transaction:false
drop index concurrently if exists app.event_engineer_idx;
```

`concurrently` cannot run inside a transaction, which dbmate opens by default,
hence `transaction:false` on both sections. Keep it to one statement per
migration: without a transaction, a failure halfway leaves the earlier
statements applied. A failed concurrent build also leaves an `invalid` index
behind, so `if not exists` alone does not fix it. Drop it and run again.

Squawk 2.74 flags a plain `create index` on an existing table, but it does not
read dbmate's `transaction:false` comment. It passes `create index
concurrently` with or without it, so a missing `transaction:false` only shows
up when Postgres refuses the statement at `dbmate up` (in CI, the `db` job).
Check for it in review. A new table and its indexes in the same migration is
fine without `concurrently`, since nothing writes to it yet.

## Layout

| Path          | What                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `migrations/` | dbmate migrations, named `YYYYMMDDHHMMSS_what.sql`                                        |
| `init/`       | Runs once when the compose volume is created: the local service user                      |
| `seeds/`      | Not created yet. Reference data safe to load anywhere, like the default price book (BE-4) |

Synthetic people and traffic are not seeds. They come from `packages/testkit`,
so nobody loads fake engineers into a real database by accident.
