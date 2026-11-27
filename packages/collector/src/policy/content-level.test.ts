import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { TelemetryEvent } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import { applyPolicy, findContent } from './content-level.js';

const require = createRequire(import.meta.url);
const fixture = TelemetryEvent.parse(
  JSON.parse(
    readFileSync(require.resolve('@fwcoach/contracts/fixtures/v2/agent_invoked.json'), 'utf8'),
  ),
);

describe('applyPolicy', () => {
  it('sends a clean event unchanged at L1', () => {
    expect(applyPolicy(fixture, 'L1')).toEqual({ action: 'send', event: fixture });
  });

  it('drops an event that carries prompt text, at any level', () => {
    const leaky = {
      ...fixture,
      data: { ...fixture.data, prompt: 'secret plan' },
    } as TelemetryEvent;
    for (const level of ['L0', 'L1'] as const) {
      expect(applyPolicy(leaky, level).action).toBe('drop');
    }
  });

  it('drops an event whose msg carries a path', () => {
    const leaky = { ...fixture, msg: '/Users/someone/secret.txt' };
    expect(applyPolicy(leaky, 'L1').action).toBe('drop');
  });

  it('removes the repo name at L0', () => {
    const result = applyPolicy(fixture, 'L0');
    expect(result.action === 'send' && result.event.repo.name).toBeNull();
  });

  it('refuses L2 until it is built and reviewed', () => {
    expect(applyPolicy(fixture, 'L2').action).toBe('drop');
  });
});

describe('findContent', () => {
  it('finds nested keys inside arrays', () => {
    expect(findContent({ a: [{ b: { file_path: 'x' } }] })).toEqual(['$.a[0].b.file_path']);
  });

  it('matches key spellings across harnesses', () => {
    expect(findContent({ filePath: 'x', OLD_STRING: 'y', 'tool-input': {} })).toHaveLength(3);
  });

  it('flags path-like values under innocent keys', () => {
    expect(findContent({ target: '/Users/someone/app/main.ts' })).toHaveLength(1);
    expect(findContent({ target: 'C:\\work\\app' })).toHaveLength(1);
  });

  it('leaves ordinary values alone', () => {
    expect(findContent({ name: 'Read', duration_ms: 12, ok: true })).toEqual([]);
  });
});
