import { z } from 'zod';

/**
 * Values the v2 pipeline accepts in `source.ide` today.
 */
export const PipelineIde = {
  ClaudeCode: 'claude-code',
  Cursor: 'cursor',
} as const;

/**
 * Every harness this project reports on. `cursor-agent` and `kiro` are not
 * accepted by the pipeline yet (proposed in X-1). The sponsor spec (6.2)
 * reports the Cursor IDE and the Cursor CLI agent as two harnesses so the
 * dashboards can tell IDE work from terminal work.
 */
export const Harness = {
  ...PipelineIde,
  CursorAgent: 'cursor-agent',
  Kiro: 'kiro',
} as const;
export type Harness = (typeof Harness)[keyof typeof Harness];

export const HarnessSchema = z.enum([
  Harness.ClaudeCode,
  Harness.Cursor,
  Harness.CursorAgent,
  Harness.Kiro,
]);

export const HarnessLabel: Record<Harness, string> = {
  [Harness.ClaudeCode]: 'Claude Code',
  [Harness.Cursor]: 'Cursor',
  [Harness.CursorAgent]: 'Cursor Agent',
  [Harness.Kiro]: 'Kiro',
};
