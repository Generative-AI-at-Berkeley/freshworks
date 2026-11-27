import type { api } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildSkillRows,
  filterSkillRows,
  SortKey,
  sortSkillRows,
  StatusFilter,
} from '@/lib/skill-rows';
import { SkillStatus, skillStatus } from '@/lib/skill-status';

function skill(overrides: Partial<api.SkillAdoptionRow>): api.SkillAdoptionRow {
  return {
    skillId: 's',
    name: 's',
    harness: 'claude-code',
    installedEngineers: 10,
    activeEngineers: 5,
    invocations: 0,
    medianDaysToFirstUse: null,
    trend: [],
    departments: [],
    ...overrides,
  };
}

const flat = (value: number, days = 14) =>
  Array.from({ length: days }, (_, i) => ({
    day: `2026-11-${String(i + 1).padStart(2, '0')}`,
    activeEngineers: value,
  }));

describe('skillStatus', () => {
  it('does not judge a skill with too few installs', () => {
    expect(skillStatus(skill({ installedEngineers: 2, activeEngineers: 0 }))).toBe(
      SkillStatus.TooFew,
    );
  });

  it('separates installed-but-never-used from low adoption', () => {
    expect(skillStatus(skill({ activeEngineers: 0 }))).toBe(SkillStatus.NotActivated);
    expect(skillStatus(skill({ activeEngineers: 2 }))).toBe(SkillStatus.Low);
  });

  it('flags a week-over-week fall before looking at the rate', () => {
    const trend = [...flat(4, 7), ...flat(2, 7)];
    expect(skillStatus(skill({ activeEngineers: 8, trend }))).toBe(SkillStatus.Declining);
  });

  it('needs two whole weeks to call a decline', () => {
    const trend = [...flat(4, 6), ...flat(1, 6)];
    expect(skillStatus(skill({ activeEngineers: 8, trend }))).toBe(SkillStatus.Strong);
  });
});

describe('skill rows', () => {
  const data: api.SkillAdoption = {
    range: { from: '2026-11-01', to: '2026-11-15' },
    dataThrough: '2026-11-14',
    totals: {
      engineersInScope: 10,
      engineersWithSkills: 9,
      engineersUsingSkills: 6,
      engineersUsingLast7Days: 4,
      trend: [],
    },
    skills: [
      skill({ skillId: 'b', name: 'beta', activeEngineers: 0, medianDaysToFirstUse: null }),
      skill({
        skillId: 'a',
        name: 'alpha',
        activeEngineers: 9,
        medianDaysToFirstUse: 3,
        harness: 'kiro',
      }),
      skill({ skillId: 'c', name: 'gamma', activeEngineers: 2, medianDaysToFirstUse: 1 }),
    ],
  };
  const rows = buildSkillRows(data, undefined);

  it('sorts unknowns last in either direction', () => {
    expect(sortSkillRows(rows, SortKey.FirstUse, false).map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(sortSkillRows(rows, SortKey.FirstUse, true).map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('puts what needs attention first by default', () => {
    expect(sortSkillRows(rows, SortKey.Status, false).map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters by name, status and tool together', () => {
    expect(
      filterSkillRows(rows, { search: 'AL', status: StatusFilter.All, harness: 'all' }).map(
        (r) => r.id,
      ),
    ).toEqual(['a']);
    expect(
      filterSkillRows(rows, { search: '', status: StatusFilter.Attention, harness: 'all' }).map(
        (r) => r.id,
      ),
    ).toEqual(['b', 'c']);
    expect(
      filterSkillRows(rows, { search: '', status: StatusFilter.All, harness: 'kiro' }).map(
        (r) => r.id,
      ),
    ).toEqual(['a']);
  });
});
