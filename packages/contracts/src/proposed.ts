import { z } from 'zod';

import { HarnessSchema } from './harness.js';

/**
 * PROPOSED, NOT ACCEPTED. Fields we have asked Freshworks to add to the v2
 * pipeline (ticket AG-4). Until they are accepted, the collector sends them
 * under `ext.fwcoach`, which the format reserves for additions.
 *
 * Write the proposal in docs/contracts/proposed-fields.md in the same format
 * as the payload document, then keep this schema in step with it.
 */
export const CreditUsage = z.object({
  /** As reported by the harness. Never converted into tokens (ADR 0005). */
  amount: z.number().nonnegative(),
  /** The harness's own unit name, for example "credits". */
  unit: z.string(),
  /** Where the number came from, for example "kiro:session.json". */
  source: z.string(),
  spent_at: z.iso.datetime({ offset: true }),
});
export type CreditUsage = z.infer<typeof CreditUsage>;

export const FwcoachExt = z.object({
  /** Harness value the pipeline does not accept in `source.ide` yet. */
  harness: HarnessSchema.optional(),
  /** Set on events emitted from inside a subagent run. */
  parent_session_id: z.string().optional(),
  is_subagent: z.boolean().optional(),
  /** Stable ID for one subagent run, so its events can be grouped. */
  subagent_id: z.string().optional(),
  credits: CreditUsage.optional(),
});
export type FwcoachExt = z.infer<typeof FwcoachExt>;
