import type { api } from '@fwcoach/contracts';

import { type DayRange, eachDay } from '@/lib/range';
import { ORG_UNITS, subtree } from '@/mock/org';

/**
 * Mock skill usage as smooth curves over calendar dates, so any range the
 * dashboard asks for (including the previous period it compares against)
 * gets consistent numbers, the way a real rollup would. Every value here is
 * invented. None of it reaches production code paths.
 */

interface MockSkill {
  skillId: string;
  harness: api.SkillAdoptionRow['harness'];
  installed: number;
  /** Weekday active engineers at given dates, joined by straight lines and held flat outside. */
  curve: readonly (readonly [string, number])[];
  usesPerActiveDay: number;
  medianDaysToFirstUse: number | null;
}

const SKILLS: readonly MockSkill[] = [
  {
    skillId: 'code-review',
    harness: 'claude-code',
    installed: 8,
    curve: [
      ['2026-08-01', 2],
      ['2026-10-15', 4],
      ['2026-11-26', 6],
    ],
    usesPerActiveDay: 3,
    medianDaysToFirstUse: 2,
  },
  {
    skillId: 'incident-summary',
    harness: 'claude-code',
    installed: 5,
    curve: [
      ['2026-08-01', 0],
      ['2026-11-01', 1],
    ],
    usesPerActiveDay: 1,
    medianDaysToFirstUse: 11,
  },
  {
    skillId: 'migration-helper',
    harness: 'cursor',
    installed: 6,
    curve: [
      ['2026-08-01', 3],
      ['2026-11-08', 4],
      ['2026-11-26', 1],
    ],
    usesPerActiveDay: 2,
    medianDaysToFirstUse: 4,
  },
  {
    skillId: 'pr-describer',
    harness: 'cursor-agent',
    installed: 2,
    curve: [
      ['2026-10-01', 0],
      ['2026-11-15', 1],
    ],
    usesPerActiveDay: 2,
    medianDaysToFirstUse: 6,
  },
  {
    skillId: 'release-notes',
    harness: 'kiro',
    installed: 7,
    curve: [['2026-08-01', 0]],
    usesPerActiveDay: 0,
    medianDaysToFirstUse: null,
  },
  {
    skillId: 'test-writer',
    harness: 'claude-code',
    installed: 4,
    curve: [
      ['2026-08-01', 1],
      ['2026-10-20', 2],
      ['2026-11-26', 3],
    ],
    usesPerActiveDay: 4,
    medianDaysToFirstUse: 1,
  },
];

const at = (day: string) => Date.parse(`${day}T00:00:00Z`);

function weekdayLevel(skill: MockSkill, day: string): number {
  const t = at(day);
  const points = skill.curve;
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return 0;
  if (t <= at(first[0])) return first[1];
  if (t >= at(last[0])) return last[1];
  for (let i = 1; i < points.length; i += 1) {
    const [d1, v1] = points[i] ?? last;
    const [d0, v0] = points[i - 1] ?? first;
    if (t <= at(d1)) return v0 + ((v1 - v0) * (t - at(d0))) / (at(d1) - at(d0));
  }
  return last[1];
}

function dailyActive(skill: MockSkill, day: string): number {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  // Weekends are quiet, as they are in real usage.
  const factor = weekday === 0 || weekday === 6 ? 0.4 : 1;
  return Math.min(skill.installed, Math.round(weekdayLevel(skill, day) * factor));
}

export function skillAdoption(range: DayRange): api.SkillAdoption {
  const days = eachDay(range);
  const last7 = days.slice(-7);
  const scope = subtree('e-100').length;

  const skills = SKILLS.map((skill) => {
    const daily = days.map((day) => dailyActive(skill, day));
    const peak = Math.max(0, ...daily);
    // Distinct users over a period exceed the busiest day. One extra per four weeks, capped at installs.
    const active = peak === 0 ? 0 : Math.min(skill.installed, peak + Math.floor(days.length / 28));
    return {
      skillId: skill.skillId,
      name: skill.skillId,
      harness: skill.harness,
      installedEngineers: skill.installed,
      activeEngineers: active,
      invocations: daily.reduce((sum, value) => sum + value * skill.usesPerActiveDay, 0),
      medianDaysToFirstUse: active === 0 ? null : skill.medianDaysToFirstUse,
      trend: days.map((day, index) => ({ day, activeEngineers: daily[index] ?? 0 })),
      departments: (['org-mobile', 'org-payments', 'org-platform'] as const).map(
        (orgUnitId, index) => ({
          orgUnitId,
          name: ORG_UNITS[orgUnitId],
          activeEngineers: Math.max(0, Math.round(active / 3) + (index === 2 ? active % 3 : 0)),
        }),
      ),
    };
  });

  // Several skills share users, so distinct engineers sit well under the sum.
  const distinct = (day: string) =>
    Math.min(
      scope - 1,
      Math.round(0.6 * SKILLS.reduce((sum, skill) => sum + dailyActive(skill, day), 0)),
    );
  const trend = days.map((day) => ({ day, engineersUsingSkills: distinct(day) }));
  const peakOver = (list: string[]) => Math.max(0, ...list.map(distinct));

  return {
    range,
    dataThrough: days.at(-1) ?? null,
    totals: {
      engineersInScope: scope,
      engineersWithSkills: scope - 1,
      engineersUsingSkills: Math.min(scope - 1, peakOver(days) + 1),
      engineersUsingLast7Days: Math.min(scope - 1, peakOver(last7)),
      trend,
    },
    skills,
  };
}
