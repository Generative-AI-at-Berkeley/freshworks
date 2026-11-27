import { z } from 'zod';

import { DeliveryMessage, wrap } from './envelope.js';
import type { TelemetryEvent } from './event.js';

/*
 * The payload document fixes two things about the wire format: it is an OTLP
 * JSON logs request, and each log record's `body.bytesValue` is one base64
 * DeliveryMessage. Everything else below is the standard OTLP/HTTP JSON shape
 * (opentelemetry-proto, logs/v1). The resource attributes are our choice and
 * still need confirming with Freshworks (open question in docs/contracts).
 */

export const OTLP_LOGS_PATH = '/v1/logs';
export const SCOPE_NAME = 'fwcoach.collector';

const OtlpAttribute = z.object({
  key: z.string(),
  value: z.object({ stringValue: z.string() }),
});

const OtlpLogRecord = z.object({
  timeUnixNano: z.string(),
  observedTimeUnixNano: z.string().optional(),
  // Checked per record in decodeRecord, so one bad record cannot 400 the batch.
  body: z.object({ bytesValue: z.string() }),
});

export const OtlpLogsRequest = z.object({
  resourceLogs: z.array(
    z.object({
      resource: z.object({ attributes: z.array(OtlpAttribute) }).optional(),
      scopeLogs: z.array(
        z.object({
          scope: z.object({ name: z.string(), version: z.string().optional() }).optional(),
          logRecords: z.array(OtlpLogRecord),
        }),
      ),
    }),
  ),
});
export type OtlpLogsRequest = z.infer<typeof OtlpLogsRequest>;

function toUnixNano(iso: string): string {
  return (BigInt(Date.parse(iso)) * 1_000_000n).toString();
}

export interface EncodeOptions {
  /** Collector version, sent as the `service.version` resource attribute. */
  agentVersion: string;
}

/** Encodes events as one OTLP logs request. Order is preserved. */
export function encodeBatch(
  events: readonly TelemetryEvent[],
  { agentVersion }: EncodeOptions,
): OtlpLogsRequest {
  return {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'fwcoach-collector' } },
            { key: 'service.version', value: { stringValue: agentVersion } },
          ],
        },
        scopeLogs: [
          {
            scope: { name: SCOPE_NAME, version: agentVersion },
            logRecords: events.map((event) => ({
              timeUnixNano: toUnixNano(event.occurred_at),
              body: {
                bytesValue: Buffer.from(JSON.stringify(wrap(event)), 'utf8').toString('base64'),
              },
            })),
          },
        ],
      },
    ],
  };
}

export type DecodedRecord =
  | { ok: true; index: number; message: DeliveryMessage }
  | { ok: false; index: number; error: string };

/**
 * Decodes every record in a request. A bad record does not fail the batch:
 * the receiver accepts the good ones and reports the rest, so one malformed
 * event cannot block a device's whole buffer.
 */
export function decodeBatch(request: OtlpLogsRequest): DecodedRecord[] {
  const out: DecodedRecord[] = [];
  let index = 0;
  for (const resourceLog of request.resourceLogs) {
    for (const scopeLog of resourceLog.scopeLogs) {
      for (const record of scopeLog.logRecords) {
        out.push(decodeRecord(index++, record.body.bytesValue));
      }
    }
  }
  return out;
}

function decodeRecord(index: number, bytesValue: string): DecodedRecord {
  if (!z.base64().safeParse(bytesValue).success) {
    return { ok: false, index, error: 'body.bytesValue is not base64' };
  }
  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(bytesValue, 'base64').toString('utf8'));
  } catch {
    return { ok: false, index, error: 'body is not base64 JSON' };
  }
  const parsed = DeliveryMessage.safeParse(json);
  return parsed.success
    ? { ok: true, index, message: parsed.data }
    : { ok: false, index, error: z.prettifyError(parsed.error) };
}
