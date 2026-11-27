import type { api } from '@fwcoach/contracts';

import {
  adoptionRate,
  NEEDS_ATTENTION,
  type SkillStatus,
  skillStatus,
  STATUS_META,
  weekOverWeek,
} from '@/lib/skill-status';

/** One table row: the API's fields plus what the dashboard derives from them. */
export interface SkillRow {
  id: string;
  skill: api.SkillAdoptionRow;
  status: SkillStatus;
  rate: number | null;
  /** Average daily users, last 7 days and the 7 before. Null when the period is under two weeks. */
  week: { current: number; prior: number } | null;
  /** Adoption rate in the previous period, when that period has this skill. */
  previousRate: number | null;
}

export function buildSkillRows(
  data: api.SkillAdoption,
  previous: api.SkillAdoption | undefined,
): SkillRow[] {
  const before = new Map(previous?.skills.map((skill) => [skill.skillId, skill]));
  return data.skills.map((skill) => {
    const prior = before.get(skill.skillId);
    return {
      id: skill.skillId,
      skill,
      status: skillStatus(skill),
      rate: adoptionRate(skill),
      week: weekOverWeek(skill.trend),
      previousRate: prior ? adoptionRate(prior) : null,
    };
  });
}

export const SortKey = {
  Status: 'status',
  Name: 'name',
  Adoption: 'adoption',
  DailyUsers: 'dailyUsers',
  Uses: 'uses',
  FirstUse: 'firstUse',
} as const;
export type SortKey = (typeof SortKey)[keyof typeof SortKey];

/** Unknowns sort last in both directions, so "Not used yet" never tops a list. */
function compareNullable(a: number | null, b: number | null, desc: boolean): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b - a : a - b;
}

export function sortSkillRows(rows: readonly SkillRow[], key: SortKey, desc: boolean): SkillRow[] {
  const byName = (a: SkillRow, b: SkillRow) => a.skill.name.localeCompare(b.skill.name);
  const compare = (a: SkillRow, b: SkillRow): number => {
    switch (key) {
      case SortKey.Status: {
        const diff = STATUS_META[a.status].order - STATUS_META[b.status].order;
        return desc ? -diff : diff;
      }
      case SortKey.Name:
        return desc ? -byName(a, b) : byName(a, b);
      case SortKey.Adoption:
        return compareNullable(a.rate, b.rate, desc);
      case SortKey.DailyUsers:
        return compareNullable(a.week?.current ?? null, b.week?.current ?? null, desc);
      case SortKey.Uses:
        return desc
          ? b.skill.invocations - a.skill.invocations
          : a.skill.invocations - b.skill.invocations;
      case SortKey.FirstUse:
        return compareNullable(a.skill.medianDaysToFirstUse, b.skill.medianDaysToFirstUse, desc);
    }
  };
  return [...rows].sort((a, b) => compare(a, b) || byName(a, b));
}

export const StatusFilter = { All: 'all', Attention: 'attention', Strong: 'strong' } as const;
export type StatusFilter = (typeof StatusFilter)[keyof typeof StatusFilter];

export function filterSkillRows(
  rows: readonly SkillRow[],
  { search, status, harness }: { search: string; status: StatusFilter; harness: string },
): SkillRow[] {
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (needle && !row.skill.name.toLowerCase().includes(needle)) return false;
    if (harness !== 'all' && row.skill.harness !== harness) return false;
    if (status === StatusFilter.Attention) return NEEDS_ATTENTION.has(row.status);
    if (status === StatusFilter.Strong) return row.status === 'strong';
    return true;
  });
}
