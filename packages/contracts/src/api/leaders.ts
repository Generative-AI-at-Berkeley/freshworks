import { z } from 'zod';

import { Cost, Coverage, Day, PersonRef, Range } from './common.js';

/**
 * `GET /v1/leaders/{managerId}/rollup?depth=`. Draft from X-3 (dashboard).
 * BE-3 owns the final shape. Teams are as of each day in the range, so a
 * reorg moves future totals and leaves past ones alone (BE-2).
 */
export const TeamRollup = z.strictObject({
  managerId: z.string(),
  managerName: z.string(),
  engineers: z.number().int().nonnegative(),
  activeEngineers: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  cost: Cost,
  subagentShare: Coverage.nullable(),
});
export type TeamRollup = z.infer<typeof TeamRollup>;

/**
 * A direct report as the drill-down lists them: enablement signals only, no
 * volume. Sorted by name.
 */
export const ReportSummary = z.strictObject({
  engineerId: z.string(),
  name: z.string(),
  harnesses: z.array(z.string()),
  skillsInstalled: z.number().int().nonnegative(),
  skillsNeverUsed: z.number().int().nonnegative(),
});
export type ReportSummary = z.infer<typeof ReportSummary>;

export const LeaderRollup = z.strictObject({
  manager: PersonRef,
  /** Managers above `manager`, top first, as of the end of the range. Empty at the top. */
  chain: z.array(PersonRef),
  depth: z.number().int().min(1),
  range: Range,
  /** Last day with a finished rollup. */
  dataThrough: Day.nullable(),
  total: TeamRollup.omit({ managerId: true, managerName: true }),
  teams: z.array(TeamRollup),
  directReports: z.array(ReportSummary),
});
export type LeaderRollup = z.infer<typeof LeaderRollup>;
