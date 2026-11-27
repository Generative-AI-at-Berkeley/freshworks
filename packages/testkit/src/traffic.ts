import type { TelemetryEvent } from '@fwcoach/contracts';

import type { SyntheticPerson } from './org.js';

/** What one synthetic device uploads, under its own credential. */
export interface DeviceTraffic {
  employeeId: string;
  deviceId: string;
  /** Bearer token ingest-mock maps to this device and engineer. */
  token: string;
  events: TelemetryEvent[];
}

/**
 * A synthetic day of collector traffic for the given people: sessions across
 * all harnesses, some subagent runs, token usage, Kiro credits, skill
 * invocations, plus a few duplicates and one oversized event, so ingestion's
 * idempotency and rejection paths are exercised.
 *
 * TODO(AG-1): implement. Validate every event with `TelemetryEvent.parse` and
 * build IDs with `eventId`, so this traffic has exactly the shape real
 * traffic has. Use fixed synthetic values for `device.os` and `os_version`,
 * never the host machine's.
 */
export function generateDay(
  _people: readonly SyntheticPerson[],
  _day: string,
  _seed: number,
): DeviceTraffic[] {
  throw new Error('generateDay not implemented (AG-1)');
}
