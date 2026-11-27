import { describe, it } from 'vitest';

/**
 * The spec 7.7 acceptance run, automated. Assumes the compose stack is up:
 * `docker compose up -d --wait`. AG-1 owns the runner and the synthetic day
 * of traffic every block below starts from.
 *
 * Each todo is one acceptance criterion, tagged with the ticket that owns it.
 * The owner turns it into a real test as part of their ticket. Do not delete one.
 */
describe('end to end', () => {
  describe('collector and ingest', () => {
    it.todo('AG-1: ten synthetic engineers in three departments upload a day of traffic');
    it.todo('AG-1: no event in Postgres carries prompt text or a file path');
    it.todo('BE-1: a replayed batch creates no duplicate rows');
    it.todo('BE-1: an oversized event arrives as event_rejected, and the rest of its batch lands');
  });

  describe('harnesses', () => {
    it.todo('AG-2: a Claude Code session with a subagent lands with the parent link set');
    it.todo('AG-3: Cursor IDE and Cursor Agent sessions land as two separate harnesses');
    it.todo('AG-4: Kiro credits land as credits, with their source and spend time');
    it.todo('AG-4: an installed but never-invoked skill shows as installed with zero invocations');
  });

  describe('rollups and cost', () => {
    it.todo('BE-3: daily rollups match the totals of the raw events');
    it.todo('BE-3: subagent tokens count inside the parent session and are broken out');
    it.todo('BE-4: cost is null with a reason when no rate exists, never zero');
    it.todo('BE-4: changing a price changes rollup cost and leaves raw events untouched');
    it.todo('BE-4: fleet health shows agent versions and ingest failure rates');
  });

  describe('access', () => {
    it.todo(
      'BE-2: a manager sees their subtree, including the team that moved in the reorg, only from the reorg date',
    );
    it.todo('BE-2: a non-manager gets 403 on another engineer');
    it.todo('BE-2: every individual view writes an access_log row an admin can read');
  });
});
