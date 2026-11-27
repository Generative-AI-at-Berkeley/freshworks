# Local development

## Setup

```sh
corepack enable            # gives you the pnpm version pinned in package.json
pnpm install
cp .env.example .env
```

Needs Node 24 (`.nvmrc`; 22 works), Docker, and Python 3. Optional:
`brew install gitleaks` so the pre-commit hook scans for secrets.

## Run things

```sh
pnpm dev:infra             # Postgres 18 on localhost:5432
pnpm db:up                 # apply migrations
pnpm dev:ingest            # mock pipeline on :4318, reloads on change
pnpm dev:api               # query API on :8080, reloads on change
```

Try them:

```sh
curl localhost:4318/healthz
curl localhost:8080/readyz
curl -H 'X-Dev-Engineer: E1' localhost:8080/v1/me/data
```

Collector:

```sh
pnpm --filter @fwcoach/collector status
pnpm --filter @fwcoach/collector dry-run    # prints the OTLP request, sends nothing
```

Every `dev`, `dry-run`, `status` and `job` script loads the root `.env` with
`--env-file-if-exists`. Variables already exported in your shell win.

## Whole stack in containers

```sh
docker compose up -d --build --wait
docker compose logs -f ingest-mock
docker compose down -v      # -v also deletes the database volume
```

Port already in use (a local Postgres, another project on 8080):

```sh
POSTGRES_PORT=55432 API_PORT=18080 docker compose up -d --wait
```

## Tests

| Command         | Runs                                           | Needs                                          |
| --------------- | ---------------------------------------------- | ---------------------------------------------- |
| `pnpm test`     | Unit tests                                     | nothing                                        |
| `pnpm test:int` | `*.int.test.ts`                                | migrated Postgres, `APP_DATABASE_URL` exported |
| `pnpm test:e2e` | `e2e/`                                         | the compose stack                              |
| `pnpm check`    | lint, content lint, format, types, unit, build | nothing                                        |

## Common problems

- **`Cannot find module '@fwcoach/contracts'` when running `node` directly.**
  Workspace packages resolve to `dist/` without the source condition. Use the
  `dev` scripts (they pass `--conditions=@fwcoach/source`) or run `pnpm build`.
- **`password authentication failed for user "fwcoach_api"`.** Your Postgres
  volume predates `db/init/`. Run `docker compose down -v` and start again.
  This deletes local data.
- **dbmate says `DATABASE_URL` is missing.** It reads `.env` from the repo
  root. Run it through `pnpm db:*` from the root.
- **Content lint fails on a dash.** Your editor turned `--` into an em dash.
  Use a period or a plain hyphen.
