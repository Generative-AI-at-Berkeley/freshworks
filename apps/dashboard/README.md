# Dashboard

The four views from spec 7.6, built with Freshworks' Dew design system on
top of the query API. Ticket: X-3 ([#16](https://github.com/Generative-AI-at-Berkeley/fwcoach/issues/16)).

```sh
pnpm dev:dashboard        # http://localhost:3000, on mock data
```

With no `API_BASE_URL` it runs on a synthetic org in `src/mock`, so it works
before any backend route lands. To use the API, copy `.env.example` to
`.env.local`, run `pnpm dev:api`, and set `API_BASE_URL` plus the dev identity.

## How it fits together

```
browser ──► /api/v1/* (src/app/api/v1) ──► query API, or src/mock
              adds the identity server side
```

- **Contracts.** Response shapes are Zod schemas in
  `packages/contracts/src/api/`, shared with the API. `src/lib/api-client.ts`
  parses every response with them. They are drafts until the owning backend
  ticket agrees them, and both teams review changes.
- **Identity.** The browser never sends who it is. The proxy adds
  `X-Dev-Engineer` from config, and drops anything the browser sent. OIDC
  replaces this after BE-2.
- **Mock mode.** `src/mock` answers every route the API will, typed against
  the contracts. A test parses each mock response with the real schema.

## Layout

| Path                    | What                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `src/app`               | Routes. Pages are thin: they pick a view and its id.        |
| `src/app/api`           | The proxy and the session route. Server only.               |
| `src/components/views`  | One per dashboard view. Data fetching and layout live here. |
| `src/components/common` | Loading, error and empty states, stats, sections.           |
| `src/config`            | `server.ts` (the only env reader), nav, labels, enums.      |
| `src/lib`               | API client, formatting, range, theme, query client.         |
| `src/mock`              | Synthetic org and mock responses.                           |

## Dew notes

- Components come from `@freshworks/dew-components`, tokens and fonts from
  `@freshworks/dew-styles`. Use them. Do not add a second component library.
- Dew has no chart component. X-3 picks one library and styles it with Dew
  tokens.
- Dew components ship without `"use client"`, so import them only from client
  components.
- `fonts.css` has a block the bundler cannot parse, so it is served as a
  static file. `scripts/copy-dew-fonts.mjs` copies it to `public/dew/` before
  dev and build.
- Theme is a class on `<html>`: `dew-light-theme` or `dew-dark-theme`. Style
  with Dew's CSS variables (`--color-text-primary`, `--spacing-200`, ...) in
  CSS modules. Never hardcode a color.
