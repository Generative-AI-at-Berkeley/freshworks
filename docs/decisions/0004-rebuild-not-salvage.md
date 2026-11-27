# 0004: Rebuild, using earlier attempts only as reference

- Status: accepted
- Date: 2026-11-26
- Deciders: project leads

## Context

Earlier attempts exist: two closed community Cursor PRs on the upstream
project, [microsoft/AI-Engineering-Coach](https://github.com/microsoft/AI-Engineering-Coach)
(#162 for the IDE, #224 for the agent), and related tools such as
entireio/cli. None is production-ready. The spec warns against sinking time
into someone else's abandoned work out of loyalty to time already spent.

## Decision

- Write our code from scratch against our own interfaces.
- Use the old PRs as reference, including feeding them to AI tools as
  context, mainly to learn the traps they hit: Cursor's lossy project path
  encoding, the `agentKv` join for edited files, the `sqlite3` binary
  dependency, the move from workspaceStorage to globalStorage.
- If any code is copied, keep its MIT licence and attribution in the file
  header and a NOTICE file.

## Consequences

- No inherited shape to fight, at the cost of re-deriving what the PRs knew.
  The format docs in docs/formats/ are where that knowledge lands.
