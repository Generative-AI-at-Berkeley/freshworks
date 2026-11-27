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
    expect(mockResponseFor(['fleet', 'health'], search).status).toBe(404);
  });

  it('never lists engineers by a usage metric', () => {
    const result = mockResponseFor(['leaders', 'e-100', 'rollup'], search);
    if (result.status !== 200) throw new Error(result.detail);
    const names = api.LeaderRollup.parse(result.body).directReports.map((report) => report.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
