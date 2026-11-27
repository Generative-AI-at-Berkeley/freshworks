import { z } from 'zod';

/**
 * Every `event_type` in the v2 payload document. Add a value here, a data
 * schema in `events/`, and a fixture in the same PR.
 */
export const EventType = {
  SessionStart: 'sessionStart',
  SessionEnd: 'sessionEnd',
  InventorySnapshot: 'inventory_snapshot',
  CommandInvoked: 'command_invoked',
  PdlcStageStarted: 'pdlc_stage_started',
  PdlcStageFileLoaded: 'pdlc_stage_file_loaded',
  PdlcGateCheck: 'pdlc_gate_check',
  PdlcStageCompleted: 'pdlc_stage_completed',
  ToolFailed: 'tool_failed',
  AgentInvoked: 'agent_invoked',
  TokenUsage: 'token_usage',
  PostToolUse: 'postToolUse',
  ArtifactFirstSeen: 'artifact_first_seen',
  DaemonHeartbeat: 'daemon_heartbeat',
  EventRejected: 'event_rejected',
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventTypeSchema = z.enum(Object.values(EventType) as [EventType, ...EventType[]]);
