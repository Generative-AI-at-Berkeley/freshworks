# e2e

The acceptance criteria from spec 7.7 as tests. Owned by **X-2**.

```sh
docker compose up -d --wait
pnpm test:e2e
docker compose down -v
```

CI runs this on every PR (the `e2e` job in `.github/workflows/ci.yml`),
which also proves the images build and the stack comes up healthy. Until X-2
lands, the todos show what is left.
