import { describe, it } from 'vitest';

/**
 * The spec 7.7 acceptance run, automated (ticket X-2). Assumes the compose
 * stack is up: `docker compose up -d --wait`.
 *
 * Each todo is one acceptance criterion. Replace it with a real test, do not
 * delete it.
 */
describe('end to end', () => {
  it.todo('ten synthetic engineers in three departments upload a day of traffic');
  it.todo('a replayed batch creates no duplicate rows');
  it.todo('daily rollups match the totals of the raw events');
  it.todo('subagent tokens count inside the parent session and are broken out');
  it.todo('Kiro credits are stored as credits, with cost null when no rate exists');
  it.todo(
    'a manager sees their subtree, including the team that moved in the reorg, only from the reorg date',
  );
  it.todo('a non-manager gets 403 on another engineer');
  it.todo('every individual view writes an access_log row an admin can read');
  it.todo('no event in Postgres carries prompt text or a file path');
});
