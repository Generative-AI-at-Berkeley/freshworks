import type { TelemetryEvent } from '@fwcoach/contracts';

/**
 * What happened to one upload. Every outcome says what to do with the batch,
 * so the daemon never has to guess, and no batch can block the buffer
 * forever.
 */
export type UploadOutcome =
  /** 200 with no partialSuccess. Ack the batch. */
  | { kind: 'accepted' }
  /**
   * 200 with partialSuccess. OTLP reports only a count and free text, not
   * which records, so ack the whole batch and log the message. Resending
   * would be rejected the same way.
   */
  | { kind: 'partial'; rejectedCount: number; errorMessage: string }
  /** 400: the request as a whole is malformed. Ack it, log it, count it. A collector bug, not a retry case. */
  | { kind: 'rejected_request'; reason: string }
  /** 413: too big. Split the batch in half and upload each half. A single event that is still too big becomes event_rejected. */
  | { kind: 'too_large' }
  /** 429. Keep the batch and wait at least `retryAfterMs`. */
  | { kind: 'rate_limited'; retryAfterMs: number }
  /** Network error or 5xx. Keep the batch and back off. */
  | { kind: 'retryable'; reason: string }
  /** 401 after one credential refresh. Stop uploading and report in the heartbeat. */
  | { kind: 'unauthorized' };

export interface Uploader {
  upload(events: readonly TelemetryEvent[]): Promise<UploadOutcome>;
}

/**
 * Sends one OTLP batch (see `encodeBatch` in contracts) to `${ingestUrl}/v1/logs`.
 *
 * TODO(AG-1): implement, with a constructor taking the ingest URL, a
 * CredentialProvider and the agent version. The rules it has to follow:
 * - Retry the same events with the same IDs. Never mint new IDs on retry.
 * - Honour Retry-After on 429, in both its seconds and HTTP-date forms. The
 *   server has burst limits, so add jitter to every backoff.
 * - Never log a token, a request body or an event payload.
 */
export class HttpUploader implements Uploader {
  constructor(private readonly ingestUrl: string) {}

  upload(_events: readonly TelemetryEvent[]): Promise<UploadOutcome> {
    return Promise.reject(new Error(`HttpUploader not implemented (AG-1): ${this.ingestUrl}`));
  }
}
