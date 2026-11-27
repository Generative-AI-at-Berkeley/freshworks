import { z } from 'zod';

import { HarnessSchema } from '../harness.js';
import { Range } from './common.js';

/**
 * `GET /v1/engineers/{engineerId}`. Draft from X-3 (dashboard). BE-2 owns the
 * final shape. Every successful call writes `access_log`.
 *
 * The page leads with enablement: what this person could try next. It has no
 * volume counters to compare people by.
 */
export const EngineerDetail = z.strictObject({
  engineer: z.strictObject({
    id: z.string(),
    name: z.string(),
    orgUnit: z.strictObject({ id: z.string(), name: z.string() }),
  }),
  range: Range,
  harnesses: z.array(z.strictObject({ harness: HarnessSchema, activeDays: z.number().int() })),
  skillsInstalled: z.array(
    z.strictObject({ skillId: z.string(), name: z.string(), invocations: z.number().int() }),
  ),
  /** Skills popular in the engineer's department that they do not have. */
  suggestedSkills: z.array(
    z.strictObject({
      skillId: z.string(),
      name: z.string(),
      departmentActiveShare: z.number().min(0).max(1),
    }),
  ),
});
export type EngineerDetail = z.infer<typeof EngineerDetail>;
