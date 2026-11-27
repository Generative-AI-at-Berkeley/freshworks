import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TelemetryEvent } from './event.js';
import { decodeBatch, encodeBatch, OtlpLogsRequest } from './otlp.js';

const fixture = (name: string) =>
  TelemetryEvent.parse(
    JSON.parse(readFileSync(join(import.meta.dirname, '..', 'fixtures', 'v2', name), 'utf8')),
  );

describe('OTLP encoding', () => {
  const events = [fixture('sessionStart.json'), fixture('token_usage.json')];

  it('round-trips a batch without changing any event', () => {
    const request = encodeBatch(events, { agentVersion: '0.1.0' });
    expect(OtlpLogsRequest.safeParse(request).success).toBe(true);

    const decoded = decodeBatch(request);
    expect(decoded.map((r) => (r.ok ? r.message.payload : r.error))).toEqual(events);
  });

  it('sets msg_id to the event_id', () => {
    const [record] = decodeBatch(encodeBatch(events, { agentVersion: '0.1.0' }));
    expect(record?.ok && record.message.msg_id).toBe(events[0]?.event_id);
  });

  it('reports a non-base64 record without failing the request', () => {
    const request = encodeBatch(events, { agentVersion: '0.1.0' });
    request.resourceLogs[0]!.scopeLogs[0]!.logRecords[1]!.body.bytesValue = '%%%';
    expect(OtlpLogsRequest.safeParse(request).success).toBe(true);
    expect(decodeBatch(request).map((r) => r.ok)).toEqual([true, false]);
  });

  it('reports a bad record without failing the others', () => {
    const request = encodeBatch(events, { agentVersion: '0.1.0' });
    const records = request.resourceLogs[0]!.scopeLogs[0]!.logRecords;
    records[0]!.body.bytesValue = Buffer.from('not json').toString('base64');

    const decoded = decodeBatch(request);
    expect(decoded.map((r) => r.ok)).toEqual([false, true]);
  });
});
