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

/**
 * Distinct engineers across all skills. Per-skill counts cannot be summed
 * (one engineer uses several skills), so the API counts these itself.
 * Installation, activation and ongoing use are separate on purpose.
 */
export const AdoptionTotals = z.strictObject({
  /** Engineers the caller may see (their subtree, or everyone for an admin). */
  engineersInScope: z.number().int().nonnegative(),
  /** Have at least one shared skill installed at the end of the range. */
  engineersWithSkills: z.number().int().nonnegative(),
  /** Used at least one shared skill in the range. */
  engineersUsingSkills: z.number().int().nonnegative(),
  /** Used at least one shared skill in the last 7 days of the range. */
  engineersUsingLast7Days: z.number().int().nonnegative(),
  /** Distinct engineers using any shared skill, per day. */
  trend: z.array(
    z.strictObject({ day: Day, engineersUsingSkills: z.number().int().nonnegative() }),
  ),
});
export type AdoptionTotals = z.infer<typeof AdoptionTotals>;

export const SkillAdoption = z.strictObject({
  range: Range,
  /** Last day with a finished rollup. Days after it in the range are not counted yet. */
  dataThrough: Day.nullable(),
  totals: AdoptionTotals,
  /** Sorted by skill name. Never by usage. */
  skills: z.array(SkillAdoptionRow),
});
export type SkillAdoption = z.infer<typeof SkillAdoption>;
