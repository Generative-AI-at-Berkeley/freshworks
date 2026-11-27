# 0002: Ingest through the Freshworks telemetry pipeline

- Status: accepted
- Date: 2026-11-26
- Deciders: project leads, following the Freshworks platform team's direction

## Context

The spec (7.5) sketched our own `POST /v1/ingest/batch` with OIDC device
flow. Freshworks then told us they already run a telemetry pipeline for this:

- Jamf pushes a one-time registration credential with the package. On first
  run the device registers. Registration is validated against Jamf.
- The backend issues a rotating device credential. Every upload is signed
  with it, and the backend identifies engineer and device from it.
- Events are buffered locally and flushed every 5 minutes. The server is
  idempotent on replays and enforces rate and burst limits.
- The format is their v2 payload: OTLP JSON logs, one base64 message per
  log record.
- New fields are proposed to them in the same format, and they extend the
  pipeline.
- This covers ingestion only, not the query API.

## Decision

- The collector speaks the v2 format to the pipeline and reuses its device
  flow. No sign-in of our own.
- We build `services/ingest-mock` with the same payload, auth shape, buffering
  cadence, idempotency and rate-limit behaviour, and develop against it.
- Real endpoints and credentials stay in a Freshworks repo and reach us as
  configuration.
- Fields we need go to Freshworks as a proposal (AG-4) and travel under
  `ext.fwcoach` until accepted.
- The query API is ours, with OIDC for people, as the spec describes.

## Consequences

- No device registration or token issuance code in production paths.
- We depend on Freshworks to accept our field proposal. Until they do, Kiro
  and Cursor Agent events carry their real harness only in `ext`.
- The mock can drift from the real pipeline. Anything we learn about the real
  one goes into docs/contracts/ingest.md and the mock's tests.
