# 0005: Credits stay credits, cost is sourced or null

- Status: accepted
- Date: 2026-11-26
- Deciders: project leads

## Context

Kiro reports consumption in credits, not tokens. Some teams run self-hosted
models with no per-token price. The spec forbids converting credits into
made-up token counts. Prices change, and the dashboards will be read by
leaders making spending decisions.

## Decision

- Store usage in the unit the harness reported. Credits are recorded with
  their source and the time they were spent.
- Cost comes from a `price_book`: token prices per model and token class,
  credit rates per provider, GPU-hour rates for self-hosted deployments. Every
  row has a source and an effective date.
- If no sourced rate exists for that usage and date, cost is `null` with a
  reason, never `0` and never an estimate dressed as fact.
- The API and dashboards show credits and cost side by side and say plainly
  when cost could not be computed.
- Changing a price recomputes rollups. It never rewrites raw events.

## Consequences

- Totals can be partly unknown. The API returns coverage ("cost known for 82%
  of usage") alongside every cost total.
- The spec's check, reproducing a real invoice within 10% for one harness,
  becomes a test fixture once someone has a real bill to compare against.
