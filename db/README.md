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

## Layout

| Path          | What                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------- |
| `migrations/` | dbmate migrations, named `YYYYMMDDHHMMSS_what.sql`                                        |
| `init/`       | Runs once when the compose volume is created: the local service user                      |
| `seeds/`      | Not created yet. Reference data safe to load anywhere, like the default price book (BE-4) |

Synthetic people and traffic are not seeds. They come from `packages/testkit`,
so nobody loads fake engineers into a real database by accident.
