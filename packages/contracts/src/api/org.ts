import { z } from 'zod';

import { HarnessSchema } from '../harness.js';
import { Cost, Coverage, Distribution, Measured, Range } from './common.js';

/**
 * `GET /v1/org/{orgUnitId}/overview`. Draft from X-3 (dashboard). BE-3 owns
 * the final shape, BE-4 owns the cost fields.
 */
export const HarnessUsage = z.strictObject({
  harness: HarnessSchema,
  activeEngineers: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  tokens: Measured,
  tokenCoverage: Coverage,
  /** Kiro reports credits. Never converted to tokens (ADR 0005). */
  credits: Measured,
  cost: Cost,
});
export type HarnessUsage = z.infer<typeof HarnessUsage>;

export const OrgOverview = z.strictObject({
  orgUnit: z.strictObject({ id: z.string(), name: z.string() }),
  range: Range,
  engineers: z.number().int().nonnegative(),
  activeEngineers: z.number().int().nonnegative(),
  harnesses: z.array(HarnessUsage),
  cost: Cost,
  sessionsPerEngineer: Distribution,
  /** Share of session tokens spent in subagents (ADR 0003). */
  subagentShare: Coverage.nullable(),
});
export type OrgOverview = z.infer<typeof OrgOverview>;
