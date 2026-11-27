<!-- Title: "<ticket>: what changed", for example "BE-2: dedupe on msg_id". -->

## What and why

<!-- One or two sentences. Link the ticket. -->

Ticket:

## How I checked it

<!-- The command you ran and what you saw. "Tests pass" alone is not enough
for behaviour changes: say what you exercised. -->

## Checklist

- [ ] `pnpm check` passes locally
- [ ] Tests cover the change, and fail without it
- [ ] Docs updated if behaviour, the contract, the schema or the API changed
- [ ] No real data: fixtures and examples are synthetic, no internal URLs or names
- [ ] Contract change (`packages/contracts`)? Both teams have reviewed it
- [ ] Migration? It has a working `migrate:down` and `docs/data-model.md` is updated
