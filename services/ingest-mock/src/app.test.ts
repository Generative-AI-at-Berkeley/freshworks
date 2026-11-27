import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { encodeBatch, TelemetryEvent } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import { buildApp } from './app.js';
import { buildMetricsApp, createMetrics } from './metrics.js';
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

describe('ingest observability', () => {
  it('keeps the bearer token and the event body out of the logs', async () => {
    const lines: string[] = [];
    const token = 'dev_SECRET_TOKEN_123';
    const app = buildApp({
      store: new MemoryEventStore(),
      logStream: { write: (line) => void lines.push(line) },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/v1/logs',
      headers: { authorization: `Bearer ${token}` },
      payload: batch,
    });
    expect(res.statusCode).toBe(200);
    app.log.info({ headers: { authorization: `Bearer ${token}` }, body: batch }, 'direct');

    const output = lines.join('');
    expect(output).toContain('batch stored');
    expect(output).not.toContain(token);
    const encoded = batch.resourceLogs[0]!.scopeLogs[0]!.logRecords[0]!.body.bytesValue;
    expect(output).not.toContain(encoded.slice(0, 24));
    expect(output).not.toContain(event.event_id);
  });

  it('counts accepted, duplicate and rejected records, and returns the request ID', async () => {
    const metrics = createMetrics();
    const app = buildApp({ store: new MemoryEventStore(), logger: false, metrics });
    const bad = structuredClone(batch);
    bad.resourceLogs[0]!.scopeLogs[0]!.logRecords.push({
      timeUnixNano: '0',
      body: { bytesValue: Buffer.from('{}').toString('base64') },
    });
    await app.inject({ method: 'POST', url: '/v1/logs', headers: auth, payload: batch });
    await app.inject({ method: 'POST', url: '/v1/logs', headers: auth, payload: bad });
    const unauthorized = await app.inject({ method: 'POST', url: '/v1/logs', payload: batch });
    expect(unauthorized.json()).toMatchObject({
      status: 401,
      requestId: unauthorized.headers['x-request-id'],
    });
    expect((await app.inject('/metrics')).statusCode).toBe(404);

    const text = (await buildMetricsApp(metrics.registry).inject('/metrics')).body;
    expect(text).toContain('fwcoach_ingest_records_total{outcome="accepted"} 1');
    expect(text).toContain('fwcoach_ingest_records_total{outcome="duplicate"} 1');
    expect(text).toContain('fwcoach_ingest_records_total{outcome="rejected"} 1');
    expect(text).toContain(
      'http_server_request_duration_seconds_count{method="POST",route="/v1/logs",status_code="401"} 1',
    );
  });
});
