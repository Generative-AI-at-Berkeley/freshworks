import type { TelemetryEvent } from '@fwcoach/contracts';

/**
 * Events waiting to be uploaded. The contract every implementation meets:
 *
 * - `append` is durable when it resolves. A crash after that loses nothing.
 * - `peek` returns the oldest events first and does not remove them.
 * - `ack` removes events by ID only after the server accepted them. A crash
 *   between upload and ack resends them, which is safe because event IDs are
 *   deterministic and the server de-duplicates on msg_id.
 * - Past `maxBytes`, the oldest events are evicted and counted, never the
 *   newest, and never silently. The count goes into daemon_heartbeat.
 */
export interface EventBuffer {
  append(events: readonly TelemetryEvent[]): Promise<void>;
  peek(limit: { maxEvents: number; maxBytes: number }): Promise<TelemetryEvent[]>;
  ack(eventIds: readonly string[]): Promise<void>;
  stats(): Promise<BufferStats>;
}

export interface BufferStats {
  events: number;
  bytes: number;
  /** Events evicted for space since the collector started. */
  evicted: number;
}
