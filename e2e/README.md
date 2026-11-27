# e2e

The acceptance criteria from spec 7.7 as tests. Every ticket owns its own checks here, tagged with its ID.
AG-1 owns the runner and the synthetic traffic.

```sh
docker compose up -d --wait
pnpm test:e2e
docker compose down -v
```

CI runs this on every PR (the `e2e` job in `.github/workflows/ci.yml`),
which also proves the images build and the stack comes up healthy. Until each
ticket lands, its todos show what is left.

## Dashboard smoke test

Playwright, in `dashboard/`. Boots the built dashboard in mock mode and visits
every page in `apps/dashboard/src/app`. It needs no stack. CI runs it in the
`dashboard-smoke` job.

```sh
pnpm --filter "@fwcoach/dashboard..." build
pnpm --filter @fwcoach/e2e exec playwright install chromium   # once
pnpm test:dashboard        # SMOKE_PORT=3101 if 3100 is taken
```

A new page fails the coverage check until it gets a row in `dashboard/smoke.spec.ts`.
