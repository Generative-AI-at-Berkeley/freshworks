import { z } from 'zod';

const count = z.number().int().nonnegative();

/**
 * Token counts for one generation. The pipeline only emits this from the
 * Cursor hook today. Claude Code token usage has to come from the session
 * transcripts (AG-2), and Kiro reports credits, not tokens (AG-4).
 *
 * `total` is what the harness reported. Do not recompute it: harnesses
 * disagree on whether cache reads are included.
 */
export const TokenUsageData = z.object({
  generation: z.object({
    id: z.string(),
    loop_count: count,
    status: z.string(),
  }),
  tokens: z.object({
    input: count.optional(),
    output: count.optional(),
    cache_read: count.optional(),
    cache_write: count.optional(),
    total: count.optional(),
  }),
});
export type TokenUsageData = z.infer<typeof TokenUsageData>;
