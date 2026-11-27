# Runbooks

| Runbook                                                                         | Status                               |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| [local-dev.md](local-dev.md): run and test everything on your machine           | ready                                |
| [demo.md](demo.md): `pnpm demo`, the whole stack on synthetic data              | ready, degraded steps listed inside  |
| [ingest-rejections.md](ingest-rejections.md): ingest rejection spike            | partly planned (BE-1, BE-4)          |
| [ingest-load.md](ingest-load.md): `pnpm test:load`, ingest latency budgets      | ready, against ingest-mock (BE-1)    |
| [retention.md](retention.md): retention run, dry run first                      | planned (BE-1)                       |
| [device-credential.md](device-credential.md): lost or rotated device credential | planned (BE-1, AG-1)                 |
| collector-rollout.md: packaging for Jamf, upgrades, rollback                    | TODO(AG-1)                           |
| [failure-modes.md](failure-modes.md): what breaks, how it shows up, what to do  | started, everyone adds as they learn |
| access-log-review.md: how admins review who viewed whom                         | TODO(BE-2)                           |

Spec 9.2 makes these part of the final handover.
