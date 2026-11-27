import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { TelemetryEvent } from './event.js';

const dir = join(import.meta.dirname, '..', 'fixtures', 'v2');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

describe('v2 fixtures', () => {
  it('has at least one fixture', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s parses against the schema', (file) => {
    const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const result = TelemetryEvent.safeParse(raw);
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it.each(files)('%s is named after its event_type', (file) => {
    const event = TelemetryEvent.parse(JSON.parse(readFileSync(join(dir, file), 'utf8')));
    expect(file).toBe(`${event.event_type}.json`);
  });
});

describe('TelemetryEvent', () => {
  const sample = JSON.parse(readFileSync(join(dir, 'sessionStart.json'), 'utf8')) as Record<
    string,
    unknown
  >;

  it('rejects a full path in repo.name', () => {
    const bad = { ...sample, repo: { name: '/Users/someone/code/app' } };
    expect(TelemetryEvent.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown event_type', () => {
    expect(TelemetryEvent.safeParse({ ...sample, event_type: 'nope' }).success).toBe(false);
  });
});
