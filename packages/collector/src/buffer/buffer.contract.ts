import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { TelemetryEvent } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import type { EventBuffer } from './types.js';

const require = createRequire(import.meta.url);
const base = TelemetryEvent.parse(
  JSON.parse(
    readFileSync(require.resolve('@fwcoach/contracts/fixtures/v2/sessionStart.json'), 'utf8'),
  ),
);
const withId = (n: number): TelemetryEvent => ({
  ...base,
  event_id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
});

/**
 * Shared behaviour tests. Every EventBuffer implementation runs these, so a
 * DiskBuffer is held to exactly the same rules as MemoryBuffer.
 */
export function bufferContract(name: string, make: (maxBytes: number) => Promise<EventBuffer>) {
  describe(`${name} meets the EventBuffer contract`, () => {
    it('returns oldest first and keeps events until acked', async () => {
      const buffer = await make(1_000_000);
      await buffer.append([withId(1), withId(2)]);
      const first = await buffer.peek({ maxEvents: 10, maxBytes: 1_000_000 });
      expect(first.map((e) => e.event_id)).toEqual([withId(1).event_id, withId(2).event_id]);
      expect((await buffer.peek({ maxEvents: 10, maxBytes: 1_000_000 })).length).toBe(2);

      await buffer.ack([withId(1).event_id]);
      expect((await buffer.stats()).events).toBe(1);
    });

    it('stores a re-appended event once', async () => {
      const buffer = await make(1_000_000);
      await buffer.append([withId(1)]);
      await buffer.append([withId(1)]);
      expect((await buffer.stats()).events).toBe(1);
    });

    it('evicts the oldest event when full and counts it', async () => {
      const size = Buffer.byteLength(JSON.stringify(withId(1)));
      const buffer = await make(size * 2);
      await buffer.append([withId(1), withId(2), withId(3)]);
      const left = await buffer.peek({ maxEvents: 10, maxBytes: 1_000_000 });
      expect(left.map((e) => e.event_id)).toEqual([withId(2).event_id, withId(3).event_id]);
      expect((await buffer.stats()).evicted).toBe(1);
    });
  });
}
