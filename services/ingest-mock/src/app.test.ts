import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { encodeBatch, TelemetryEvent } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { MemoryEventStore } from './store/memory-store.js';

const require = createRequire(import.meta.url);
const event = TelemetryEvent.parse(
  JSON.parse(
    readFileSync(require.resolve('@fwcoach/contracts/fixtures/v2/sessionStart.json'), 'utf8'),
  ),
);
const batch = encodeBatch([event], { agentVersion: '0.1.0' });
const auth = { authorization: 'Bearer dev_TEST' };

describe('POST /v1/logs', () => {
  it('stores a replayed batch once', async () => {
    const store = new MemoryEventStore();
    const app = buildApp({ store, logger: false });

    for (let i = 0; i < 2; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/logs',
        headers: auth,
        payload: batch,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(store.messages.size).toBe(1);
  });

  it('rejects a request without a bearer token', async () => {
    const app = buildApp({ store: new MemoryEventStore(), logger: false });
    const res = await app.inject({ method: 'POST', url: '/v1/logs', payload: batch });
    expect(res.statusCode).toBe(401);
  });

  it('reports bad records as partial success and keeps the good ones', async () => {
    const store = new MemoryEventStore();
    const app = buildApp({ store, logger: false });
    const bad = structuredClone(batch);
    bad.resourceLogs[0]!.scopeLogs[0]!.logRecords.push({
      timeUnixNano: '0',
      body: { bytesValue: Buffer.from('{}').toString('base64') },
    });

    const res = await app.inject({ method: 'POST', url: '/v1/logs', headers: auth, payload: bad });
    expect(res.json()).toMatchObject({ partialSuccess: { rejectedLogRecords: 1 } });
    expect(store.messages.size).toBe(1);
  });

  it.todo('answers 429 with Retry-After past the burst limit (BE-1)');
});
