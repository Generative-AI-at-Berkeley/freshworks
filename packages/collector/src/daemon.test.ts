import { EventType, Harness } from '@fwcoach/contracts';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';

import type { HarnessAdapter } from './adapters/types.js';
import { MemoryBuffer } from './buffer/memory-buffer.js';
import { collectOnce, runDaemon, type DaemonDeps } from './daemon.js';
import type { Uploader } from './upload/uploader.js';

const fakeAdapter = (data: Record<string, unknown>): HarnessAdapter => ({
  harness: Harness.ClaudeCode,
  detect: () => Promise.resolve({ installed: true, formats: ['test'], warnings: [] }),
  collect: () =>
    Promise.resolve({
      cursor: {},
      observations: [
        {
          type: EventType.SessionStart,
          occurredAt: '2026-10-07T11:40:19.000Z',
          sourceKey: ['s1', 0],
          msg: 'session started',
          session: { sessionId: 's1' },
          data,
        },
      ],
    }),
});

const broken: HarnessAdapter = {
  harness: Harness.Kiro,
  detect: () => Promise.reject(new Error('boom')),
  collect: () => Promise.reject(new Error('unreachable')),
};

function deps(adapters: HarnessAdapter[]): DaemonDeps {
  const uploader: Uploader = { upload: () => Promise.reject(new Error('not used')) };
  return {
    config: {
      ingestUrl: 'http://localhost:4318',
      stateDir: '/tmp/unused',
      flushIntervalSeconds: 300,
      bufferMaxBytes: 1_000_000,
      contentLevel: 'L1',
      logLevel: 'silent',
    },
    adapters,
    buffer: new MemoryBuffer(1_000_000),
    uploader,
    logger: pino({ level: 'silent' }),
    agentVersion: '0.1.0',
    deviceId: 'dev_TEST',
  };
}

describe('collectOnce', () => {
  it('buffers events from a working adapter even when another one throws', async () => {
    const d = deps([broken, fakeAdapter({})]);
    expect(await collectOnce(d, new AbortController().signal)).toEqual({ buffered: 1, dropped: 0 });
  });

  it('drops and counts an observation that carries content, without losing the pass', async () => {
    const d = deps([fakeAdapter({ prompt: 'secret' })]);
    expect(await collectOnce(d, new AbortController().signal)).toEqual({ buffered: 0, dropped: 1 });
  });
});

describe('runDaemon', () => {
  it('exits promptly when stopped during a pass instead of waiting the interval', async () => {
    const controller = new AbortController();
    const slow: HarnessAdapter = {
      ...fakeAdapter({}),
      detect: () => {
        controller.abort();
        return Promise.resolve({ installed: false, formats: [], warnings: [] });
      },
    };
    const started = Date.now();
    await runDaemon(deps([slow]), controller.signal);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
