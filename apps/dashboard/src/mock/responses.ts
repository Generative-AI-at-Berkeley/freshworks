import type { api } from '@fwcoach/contracts';

import type { DayRange } from '@/lib/range';
import {
  chainAbove,
  directReports,
  isOrgUnitId,
  ORG_UNITS,
  person,
  PEOPLE,
  subtree,
} from '@/mock/org';

/**
 * Mock responses for each query API route, typed against the contract so a
 * contract change breaks the build here first. Numbers are fixed, not random,
 * so screenshots and tests are stable.
 */

const SKILLS = [
  {
    skillId: 'code-review',
    name: 'code-review',
    harness: 'claude-code',
    installed: 9,
    active: 7,
    invocations: 412,
    days: 2,
  },
  {
    skillId: 'incident-summary',
    name: 'incident-summary',
    harness: 'claude-code',
    installed: 5,
    active: 1,
    invocations: 6,
    days: 11,
  },
  {
    skillId: 'migration-helper',
    name: 'migration-helper',
    harness: 'cursor',
    installed: 6,
    active: 4,
    invocations: 88,
    days: 4,
  },
  {
    skillId: 'release-notes',
    name: 'release-notes',
    harness: 'kiro',
    installed: 8,
    active: 0,
    invocations: 0,
    days: null,
  },
  {
    skillId: 'test-writer',
    name: 'test-writer',
    harness: 'claude-code',
    installed: 4,
    active: 3,
    invocations: 151,
    days: 1,
  },
] as const;

function days(range: DayRange): string[] {
  const out: string[] = [];
  for (
    let day = new Date(`${range.from}T00:00:00Z`);
    day.toISOString().slice(0, 10) < range.to;
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

export function skillAdoption(range: DayRange): api.SkillAdoption {
  return {
    range,
    skills: SKILLS.map((skill) => ({
      skillId: skill.skillId,
      name: skill.name,
      harness: skill.harness,
      installedEngineers: skill.installed,
      activeEngineers: skill.active,
      invocations: skill.invocations,
      medianDaysToFirstUse: skill.days,
      // A slow climb to today's active count, so the trend has a shape.
      trend: days(range).map((day, index, all) => ({
        day,
        activeEngineers: Math.round((skill.active * (index + 1)) / all.length),
      })),
      departments: (['org-platform', 'org-payments', 'org-mobile'] as const).map(
        (orgUnitId, index) => ({
          orgUnitId,
          name: ORG_UNITS[orgUnitId],
          activeEngineers: Math.max(0, Math.round(skill.active / 3) - (index === 2 ? 1 : 0)),
        }),
      ),
    })),
  };
}

export function orgOverview(orgUnitId: string, range: DayRange): api.OrgOverview | null {
  if (!isOrgUnitId(orgUnitId)) return null;
  const engineers =
    orgUnitId === 'org-eng'
      ? PEOPLE.length
      : PEOPLE.filter((p) => p.orgUnitId === orgUnitId).length;
  const scale = engineers / PEOPLE.length;
  const n = (value: number) => Math.round(value * scale);
  return {
    orgUnit: { id: orgUnitId, name: ORG_UNITS[orgUnitId] },
    range,
    engineers,
    activeEngineers: Math.max(1, engineers - 1),
    harnesses: [
      {
        harness: 'claude-code',
        activeEngineers: n(8),
        sessions: n(640),
        tokens: n(182_000_000),
        tokenCoverage: 0.97,
        credits: null,
        cost: { costUsd: n(2_140), costCoverage: 0.97 },
      },
      {
        harness: 'cursor',
        activeEngineers: n(5),
        sessions: n(410),
        tokens: n(51_000_000),
        tokenCoverage: 0.62,
        credits: null,
        cost: { costUsd: n(530), costCoverage: 0.62 },
      },
      {
        harness: 'cursor-agent',
        activeEngineers: n(3),
        sessions: n(95),
        tokens: null,
        tokenCoverage: 0,
        credits: null,
        cost: { costUsd: null, costCoverage: 0 },
      },
      // Credits with no sourced rate: shown as credits, never priced (ADR 0005).
      {
        harness: 'kiro',
        activeEngineers: n(4),
        sessions: n(120),
        tokens: null,
        tokenCoverage: 0,
        credits: n(3_400),
        cost: { costUsd: null, costCoverage: 0 },
      },
    ],
    cost: { costUsd: n(2_670), costCoverage: 0.71 },
    sessionsPerEngineer: {
      p50: 104,
      p90: 188,
      buckets: [
        { from: 0, to: 50, engineers: n(2) },
        { from: 50, to: 100, engineers: n(3) },
        { from: 100, to: 150, engineers: n(3) },
        { from: 150, to: 200, engineers: n(2) },
      ],
    },
    subagentShare: 0.18,
  };
}

export function leaderRollup(
  managerId: string,
  depth: number,
  range: DayRange,
): api.LeaderRollup | null {
  const manager = person(managerId);
  if (!manager) return null;
  const team = (lead: { id: string; name: string }) => {
    const members = subtree(lead.id);
    return {
      managerId: lead.id,
      managerName: lead.name,
      engineers: members.length,
      activeEngineers: members.length,
      sessions: members.length * 96,
      cost: { costUsd: members.length * 241, costCoverage: 0.71 },
      subagentShare: 0.18,
    };
  };
  const reports = directReports(managerId);
  const { managerId: _id, managerName: _name, ...total } = team(manager);
  return {
    manager: { id: manager.id, name: manager.name },
    chain: chainAbove(manager.id),
    depth,
    range,
    total,
    teams: reports.filter((report) => directReports(report.id).length > 0).map(team),
    directReports: reports.map((report, index) => ({
      engineerId: report.id,
      name: report.name,
      harnesses: index % 2 === 0 ? ['claude-code', 'cursor'] : ['kiro'],
      skillsInstalled: 4 + index,
      skillsNeverUsed: index % 3,
    })),
  };
}

export function engineer(engineerId: string, range: DayRange): api.EngineerDetail | null {
  const subject = person(engineerId);
  if (!subject || !isOrgUnitId(subject.orgUnitId)) return null;
  return {
    engineer: {
      id: subject.id,
      name: subject.name,
      orgUnit: { id: subject.orgUnitId, name: ORG_UNITS[subject.orgUnitId] },
    },
    chain: chainAbove(subject.id),
    range,
    harnesses: [
      { harness: 'claude-code', activeDays: 17 },
      { harness: 'cursor', activeDays: 6 },
    ],
    skillsInstalled: [
      { skillId: 'code-review', name: 'code-review', invocations: 38 },
      { skillId: 'release-notes', name: 'release-notes', invocations: 0 },
    ],
    suggestedSkills: [{ skillId: 'test-writer', name: 'test-writer', departmentActiveShare: 0.6 }],
  };
}
