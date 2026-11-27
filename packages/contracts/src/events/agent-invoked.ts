import { z } from 'zod';

/**
 * A subagent run. `session.session_id` on the event is the parent session,
 * which is why subagent work rolls up into the parent by default (ADR 0003).
 * `subagent.tokens` is the subagent's own total. Whether the parent's token
 * events already include it differs by harness and is not known yet. AG-2,
 * AG-3 and AG-4 document it per harness before BE-3 sums anything.
 */
export const AgentInvokedData = z.object({
  artifact: z.object({
    name: z.string(),
    type: z.string(),
    resolved: z.boolean(),
    plugin: z.string().optional(),
  }),
  invocation: z.object({ source: z.string() }),
  subagent: z
    .object({
      duration_ms: z.number().nonnegative(),
      model: z.string().nullable(),
      status: z.string(),
      tokens: z.number().int().nonnegative().optional(),
      tool_calls: z.number().int().nonnegative().optional(),
    })
    .optional(),
  tool: z.object({ name: z.string() }).optional(),
});
export type AgentInvokedData = z.infer<typeof AgentInvokedData>;
