import { z } from 'zod';

import { EventType } from './event-type.js';
import { AgentInvokedData } from './events/agent-invoked.js';
import { SessionStartData } from './events/session-start.js';
import { TokenUsageData } from './events/token-usage.js';
import { unmodelledData } from './events/unmodelled.js';
import { FwcoachExt } from './proposed.js';

export const SCHEMA_NAME = 'fw.ai_builder.event';
export const SCHEMA_VERSION = '2.0';

// RFC 3339 with an offset. The pipeline sends UTC with a Z suffix.
const Timestamp = z.iso.datetime({ offset: true });

// Most keys in the shared blocks are present but null when not measured, so
// they are `nullable()`, not `optional()`. See README "missing vs zero".
// Shared blocks are strict: an unknown key fails validation instead of being
// silently stripped, so drift from the Freshworks format shows up in tests.
// `pdlc` and `ext` are loose on purpose (see below).
const nullableString = z.string().nullable();

export const SourceBlock = z.strictObject({
  ide: z.string(),
  ide_version: nullableString,
  surface: nullableString,
  hook_version: z.number().int().nullable(),
  agent_version: nullableString,
});

export const DeviceBlock = z.strictObject({
  device_id: z.string(),
  machine_id: nullableString,
  os: z.string(),
  os_version: nullableString,
});

export const SessionBlock = z.strictObject({
  session_id: nullableString,
  conversation_id: nullableString,
  prompt_id: nullableString,
  source: nullableString,
});

export const ModelBlock = z.strictObject({
  name: nullableString,
  id: nullableString,
  resolved: nullableString,
  session: nullableString,
});

export const RepoBlock = z.strictObject({
  // Folder name only. A full path must never appear here (spec 7.3).
  name: nullableString.refine((v) => v === null || !/[\\/]/.test(v), {
    error: 'repo.name must be a folder name, not a path',
  }),
});

// PDLC keys vary by stage and are owned by the Freshworks workflow plugin, so
// only `active` is fixed. Extra keys pass through untouched.
export const PdlcBlock = z.looseObject({ active: z.boolean() });

const ExtBlock = z.looseObject({ fwcoach: FwcoachExt.optional() });

const base = {
  schema: z.literal(SCHEMA_NAME),
  schema_version: z.literal(SCHEMA_VERSION),
  event_id: z.uuid(),
  occurred_at: Timestamp,
  sent_at: Timestamp,
  msg: z.string(),
  source: SourceBlock,
  device: DeviceBlock,
  session: SessionBlock,
  model: ModelBlock,
  repo: RepoBlock,
  pdlc: PdlcBlock,
  ext: ExtBlock,
};

function variant<T extends EventType, D extends z.ZodType>(type: T, data: D) {
  return z.object({ ...base, event_type: z.literal(type), data });
}

/**
 * One v2 event. Discriminated on `event_type`, so `event.data` narrows after a
 * check on the type.
 *
 * TODO(AG-2, AG-3): replace each `unmodelledData` with a real schema in events/ and
 * add its fixture.
 */
export const TelemetryEvent = z.discriminatedUnion('event_type', [
  variant(EventType.SessionStart, SessionStartData),
  variant(EventType.SessionEnd, unmodelledData),
  variant(EventType.InventorySnapshot, unmodelledData),
  variant(EventType.CommandInvoked, unmodelledData),
  variant(EventType.PdlcStageStarted, unmodelledData),
  variant(EventType.PdlcStageFileLoaded, unmodelledData),
  variant(EventType.PdlcGateCheck, unmodelledData),
  variant(EventType.PdlcStageCompleted, unmodelledData),
  variant(EventType.ToolFailed, unmodelledData),
  variant(EventType.AgentInvoked, AgentInvokedData),
  variant(EventType.TokenUsage, TokenUsageData),
  variant(EventType.PostToolUse, unmodelledData),
  variant(EventType.ArtifactFirstSeen, unmodelledData),
  variant(EventType.DaemonHeartbeat, unmodelledData),
  variant(EventType.EventRejected, unmodelledData),
]);
export type TelemetryEvent = z.infer<typeof TelemetryEvent>;
