import { z } from 'zod';

import { HarnessSchema } from '../harness.js';
import { Day, Range } from './common.js';

/**
 * `GET /v1/skills/adoption`. Draft from X-3 (dashboard). BE-3 owns the final
 * shape: change it there and the dashboard follows.
 *
 * Installed and active are separate on purpose. "40 people have it" and
 * "6 people use it" are the two numbers the sponsor wants side by side.
 */
export const SkillAdoptionRow = z.strictObject({
  skillId: z.string(),
  name: z.string(),
  harness: HarnessSchema,
  installedEngineers: z.number().int().nonnegative(),
  activeEngineers: z.number().int().nonnegative(),
  invocations: z.number().int().nonnegative(),
  /** Median days from install to first use, over engineers who used it. */
  medianDaysToFirstUse: z.number().nonnegative().nullable(),
  trend: z.array(z.strictObject({ day: Day, activeEngineers: z.number().int().nonnegative() })),
  departments: z.array(
    z.strictObject({
      orgUnitId: z.string(),
      name: z.string(),
      activeEngineers: z.number().int().nonnegative(),
    }),
  ),
});
export type SkillAdoptionRow = z.infer<typeof SkillAdoptionRow>;

export const SkillAdoption = z.strictObject({
  range: Range,
  /** Sorted by skill name. Never by usage. */
  skills: z.array(SkillAdoptionRow),
});
export type SkillAdoption = z.infer<typeof SkillAdoption>;
