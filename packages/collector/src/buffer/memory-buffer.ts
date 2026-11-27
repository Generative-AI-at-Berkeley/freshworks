import type { TelemetryEvent } from '@fwcoach/contracts';

import type { BufferStats, EventBuffer } from './types.js';

/**
 * In-memory buffer for tests and `--dry-run`. Not durable, so it does not meet
 * the first rule in EventBuffer and must never back the real daemon.
 *
 * TODO(AG-1): add DiskBuffer (append-only segment files or SQLite in
 * stateDir) and run `bufferContract` against it too.
 */
export class MemoryBuffer implements EventBuffer {
  // Map iteration order is insertion order, so the first key is the oldest.
  private readonly events = new Map<string, { event: TelemetryEvent; bytes: number }>();
  private bytes = 0;
  private evicted = 0;

  constructor(private readonly maxBytes: number) {}

  append(events: readonly TelemetryEvent[]): Promise<void> {
    for (const event of events) {
      if (this.events.has(event.event_id)) continue;
      const bytes = Buffer.byteLength(JSON.stringify(event));
      this.events.set(event.event_id, { event, bytes });
      this.bytes += bytes;
    }
    while (this.bytes > this.maxBytes) {
      const oldest = this.events.keys().next();
      if (oldest.done) break;
      this.remove(oldest.value);
      this.evicted++;
    }
    return Promise.resolve();
  }

  peek({
    maxEvents,
    maxBytes,
  }: {
    maxEvents: number;
    maxBytes: number;
  }): Promise<TelemetryEvent[]> {
    const out: TelemetryEvent[] = [];
    let bytes = 0;
    for (const entry of this.events.values()) {
      if (out.length >= maxEvents || (out.length > 0 && bytes + entry.bytes > maxBytes)) break;
      out.push(entry.event);
      bytes += entry.bytes;
    }
    return Promise.resolve(out);
  }

  ack(eventIds: readonly string[]): Promise<void> {
    for (const id of eventIds) this.remove(id);
    return Promise.resolve();
  }

  stats(): Promise<BufferStats> {
    return Promise.resolve({ events: this.events.size, bytes: this.bytes, evicted: this.evicted });
  }

  private remove(id: string): void {
    const entry = this.events.get(id);
    if (entry === undefined) return;
    this.events.delete(id);
    this.bytes -= entry.bytes;
  }
}
