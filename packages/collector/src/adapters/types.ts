import type { CreditUsage, EventType, Harness } from '@fwcoach/contracts';

/**
 * What an adapter knows about one thing that happened, before it becomes a v2
 * event. Adapters only describe facts from their harness. The normalizer adds
 * the device, source and envelope fields every event shares.
 */
export interface Observation {
  type: EventType;
  /** When it happened, from the harness's own record. Never `new Date()`. */
  occurredAt: string;
  /**
   * Stable identity of the source record, for example `[sessionId, lineNo]`.
   * Becomes the event ID, so it must be identical every time the same record
   * is read again. See `eventId` in contracts.
   */
  sourceKey: readonly (string | number)[];
  msg: string;
  session: {
    sessionId: string | null;
    conversationId?: string | null;
    promptId?: string | null;
    source?: string | null;
  };
  /** Set when this happened inside a subagent run (ADR 0003). */
  subagent?: { parentSessionId: string; subagentId: string };
  model?: { name: string | null; id?: string | null };
  /** Folder name only. The normalizer rejects anything with a separator. */
  repoName?: string | null;
  credits?: CreditUsage;
  data: Record<string, unknown>;
}

/** Where an adapter got to last time, so the next pass reads only new data. */
export type Cursor = Record<string, string | number>;

export interface DetectResult {
  installed: boolean;
  /** The storage layout found, for example "kiro-dir-v3" or "cursor-3.x". */
  formats: string[];
  /** Human-readable reasons something was skipped. Shown by `fwcoach status`. */
  warnings: string[];
}

export interface CollectContext {
  /** Cursor returned by the previous pass, or undefined on first run. */
  since: Cursor | undefined;
  signal: AbortSignal;
}

export interface CollectResult {
  observations: Observation[];
  cursor: Cursor;
}

/**
 * One per harness. Implementations live in adapters/<harness>/.
 *
 * Rules every adapter follows (see docs/architecture.md):
 * - Read only. Never write to, lock or migrate a harness's files. Open SQLite
 *   read-only and immutable, or copy it first.
 * - Detect formats, do not assume one. An unknown format is a warning in
 *   DetectResult, never a crash.
 * - A field the harness does not record is left out, not set to 0.
 * - No prompt text, response text, file paths or file contents in
 *   Observation.data. The policy check drops events that have them.
 */
export interface HarnessAdapter {
  readonly harness: Harness;
  detect(): Promise<DetectResult>;
  collect(ctx: CollectContext): Promise<CollectResult>;
}
