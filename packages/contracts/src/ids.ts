import { v5 as uuidv5 } from 'uuid';

/**
 * Namespace for deterministic event IDs. Generated once for this project.
 * Changing it changes every ID and breaks de-duplication against data already
 * ingested, so treat it as permanent.
 */
export const EVENT_ID_NAMESPACE = '025e58d4-25bb-44a3-82ef-00fe6079bad4';

/**
 * Builds the event ID from facts that identify the event in its source, not
 * from when the collector happened to see it. Re-parsing the same session, or
 * retrying the same batch, then yields the same ID, and the backend drops the
 * duplicate on `msg_id`. The v2 examples use UUIDv5 the same way.
 *
 * Pass parts that are stable across re-reads: harness, session ID, the
 * record's own ID or line offset, and the event type. The result must be
 * unique across every machine, because the receiver de-duplicates fleet-wide.
 * If a harness's session IDs are only unique per machine (a counter, a
 * folder name), include the device ID too. Never a timestamp taken
 * at collection time, and never anything sensitive: the ID is sent upstream.
 */
export function eventId(...parts: readonly (string | number)[]): string {
  if (parts.length === 0) throw new Error('eventId needs at least one part');
  return uuidv5(parts.map(String).join('\u001f'), EVENT_ID_NAMESPACE);
}
