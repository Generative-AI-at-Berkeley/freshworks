# 0003: Subagent work rolls into the parent session

- Status: accepted for the principle. Per-harness mapping is pending the format work in AG-2, AG-3 and AG-4.
- Date: 2026-11-26
- Deciders: project leads

## Context

Kiro dispatches sub-executions, Claude Code runs subagents, and Cursor Agent
has subagents and orphan subagents (subagents whose parent record is missing).
Each could be its own session or part of the session that started it. The
spec recommends nesting under the parent with a diagnostic identifier, so
timeline overlap detection stays sane. The upstream project handles this
differently per harness.

## Decision

- A subagent run counts as part of its parent session for every harness.
- Events from inside it carry `is_subagent`, `parent_session_id` and
  `subagent_id` (under `ext.fwcoach` until the pipeline accepts them).
- Rollups count subagent work inside the parent and also break it out in its
  own columns, so "how much of this was subagents" is answerable.
- Proposed, to confirm once the formats are explored: an orphan subagent
  becomes its own session flagged `orphan`, never merged into a guessed parent.

We agreed on the principle before looking closely at how Kiro and Cursor
expose subagents. If the format work shows a harness where nesting loses
information, raise it as a new ADR rather than special-casing it in code.

## Consequences

- Session counts mean "sessions a person started", which is what managers
  read them as.
- Each adapter has to establish the parent link from its harness's data. How
  each harness exposes it is recorded in docs/formats/ (AG-2, AG-3, AG-4).
- Whether a parent's token totals already include its subagents differs by
  harness. Each adapter must document it before rollups sum anything, or
  tokens get counted twice.
