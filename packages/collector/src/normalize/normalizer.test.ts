import { EventType, Harness } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import type { Observation } from '../adapters/types.js';
import { normalize } from './normalizer.js';

const ctx = { harnessVersion: '1.0.0', agentVersion: '0.1.0', deviceId: 'dev_TEST' };

const obs: Observation = {
  type: EventType.SessionStart,
  occurredAt: '2026-10-07T11:40:19.000Z',
  sourceKey: ['session-1', 0],
  msg: 'session started',
  session: { sessionId: 'session-1' },
  data: {},
};

describe('normalize', () => {
  it('gives the same event ID when the same record is read twice', () => {
    const a = normalize(obs, { ...ctx, harness: Harness.ClaudeCode });
    const b = normalize(obs, {
      ...ctx,
      harness: Harness.ClaudeCode,
      sentAt: '2026-10-08T00:00:00Z',
    });
    expect(a.event_id).toBe(b.event_id);
  });

  it('keeps the real harness in ext when the pipeline does not accept it yet', () => {
    const event = normalize(obs, { ...ctx, harness: Harness.CursorAgent });
    expect(event.source.ide).toBe('cursor');
    expect(event.ext.fwcoach?.harness).toBe('cursor-agent');
  });

  it('marks subagent events with their parent', () => {
    const event = normalize(
      { ...obs, subagent: { parentSessionId: 'parent-1', subagentId: 'sub-1' } },
      { ...ctx, harness: Harness.Kiro },
    );
    expect(event.ext.fwcoach).toMatchObject({ is_subagent: true, parent_session_id: 'parent-1' });
  });

  it('rejects a repo path instead of sending it', () => {
    expect(() =>
      normalize(
        { ...obs, repoName: '/Users/someone/app' },
        { ...ctx, harness: Harness.ClaudeCode },
      ),
    ).toThrow();
  });
});
