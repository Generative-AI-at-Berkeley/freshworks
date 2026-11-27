import { z } from 'zod';

import { TelemetryEvent } from './event.js';

/**
 * The message inside each OTLP log record's `body.bytesValue`, base64 encoded.
 * Routing keys come from the payload document's delivery table.
 */
export const DeliveryDefaults = {
  account_id: 'ai-telemetry-internal',
  service: 'ai-builder-telemetry',
  payload_type: 'ai_builder_event',
  payload_version: 2,
} as const;

export const DeliveryMessage = z
  .object({
    account_id: z.string(),
    service: z.string(),
    payload_type: z.string(),
    payload_version: z.literal(DeliveryDefaults.payload_version),
    /** De-duplication key. Always equal to `payload.event_id`. */
    msg_id: z.uuid(),
    payload: TelemetryEvent,
  })
  .refine((m) => m.msg_id === m.payload.event_id, {
    error: 'msg_id must equal payload.event_id',
    path: ['msg_id'],
  });
export type DeliveryMessage = z.infer<typeof DeliveryMessage>;

export function wrap(event: TelemetryEvent): DeliveryMessage {
  return { ...DeliveryDefaults, msg_id: event.event_id, payload: event };
}
