import { api } from '@fwcoach/contracts';
import { describe, expect, it } from 'vitest';

import { mockResponseFor } from '@/mock/routes';

const search = new URLSearchParams({ from: '2026-11-01', to: '2026-11-29', depth: '2' });

// Mock mode is only useful if it looks exactly like the API. These parse every
// mock response with the same contract the dashboard parses real ones with.
describe.each([
  { path: ['skills', 'adoption'], schema: api.SkillAdoption },
  { path: ['org', 'org-eng', 'overview'], schema: api.OrgOverview },
  { path: ['org', 'org-payments', 'overview'], schema: api.OrgOverview },
  { path: ['leaders', 'e-100', 'rollup'], schema: api.LeaderRollup },
  { path: ['leaders', 'e-110', 'rollup'], schema: api.LeaderRollup },
  { path: ['engineers', 'e-111'], schema: api.EngineerDetail },
  { path: ['fleet', 'health'], schema: api.FleetHealth },
  { path: ['admin', 'access-log'], schema: api.AccessLog },
  { path: ['me', 'data'], schema: api.MyData },
])('mock /v1/$path', ({ path, schema }) => {
  it('matches the contract', () => {
    const result = mockResponseFor(path, search);
    if (result.status !== 200) throw new Error(result.detail);
    expect(schema.safeParse(result.body).error).toBeUndefined();
  });
});

describe('mock routing', () => {
  it('returns 404 for an unknown id or path', () => {
    expect(mockResponseFor(['engineers', 'nobody'], search).status).toBe(404);
    expect(mockResponseFor(['fleet', 'nothing'], search).status).toBe(404);
  });

  it('never lists engineers by a usage metric', () => {
    const result = mockResponseFor(['leaders', 'e-100', 'rollup'], search);
    if (result.status !== 200) throw new Error(result.detail);
    const names = api.LeaderRollup.parse(result.body).directReports.map((report) => report.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('mock fleet health', () => {
  const result = mockResponseFor(['fleet', 'health'], search);
  if (result.status !== 200) throw new Error(result.detail);
  const fleet = api.FleetHealth.parse(result.body);

  it('rejections by reason add up to the daily rejected counts', () => {
    const byDay = fleet.uploads.reduce((sum, day) => sum + day.rejected, 0);
    const byReason = fleet.rejections.reduce((sum, r) => sum + r.count, 0);
    expect(byReason).toBe(byDay);
  });

  it('lists quiet devices by owner name, one per quiet count', () => {
    const names = fleet.quietDevices.map((d) => d.owner.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(fleet.quietDevices).toHaveLength(fleet.devices.quiet);
  });

  it('version counts cover every device', () => {
    expect(fleet.agentVersions.reduce((sum, v) => sum + v.devices, 0)).toBe(fleet.devices.total);
  });
});

describe('mock cursor paging', () => {
  it('walks the access log without repeats and ends with a null cursor', () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    let total: number;
    do {
      const page = new URLSearchParams(search);
      if (cursor) page.set('cursor', cursor);
      const result = mockResponseFor(['admin', 'access-log'], page);
      if (result.status !== 200) throw new Error(result.detail);
      const log = api.AccessLog.parse(result.body);
      total = log.total;
      seen.push(...log.entries.map((e) => `${e.viewedAt}${e.viewer.id}${e.subject.id}`));
      cursor = log.nextCursor;
    } while (cursor);
    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
  });

  it('filters the access log to one subject', () => {
    const page = new URLSearchParams(search);
    page.set('subject', 'e-111');
    const result = mockResponseFor(['admin', 'access-log'], page);
    if (result.status !== 200) throw new Error(result.detail);
    const subjects = new Set(api.AccessLog.parse(result.body).entries.map((e) => e.subject.id));
    expect([...subjects]).toEqual(['e-111']);
  });
});
