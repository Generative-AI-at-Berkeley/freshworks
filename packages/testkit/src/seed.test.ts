import { describe, expect, it } from 'vitest';

import type { SyntheticPerson } from './org.js';
import { orgRows } from './seed.js';

const person = (
  employeeId: string,
  managerId: string | null,
  effectiveFrom: string,
  departmentId = 'dept-a',
): SyntheticPerson => ({
  employeeId,
  ssoSubject: null,
  workEmail: `${employeeId}@example.com`,
  displayName: `Person ${employeeId}`,
  departmentId,
  managerId,
  effectiveFrom: new Date(effectiveFrom),
});

describe('orgRows', () => {
  it('closes the old manager edge on the reorg date instead of rewriting it', () => {
    const rows = orgRows([
      person('top', null, '2026-01-01'),
      person('m1', 'top', '2026-01-01'),
      person('m2', 'top', '2026-01-01', 'dept-b'),
      // Listed out of order on purpose: the sync cannot rely on file order.
      person('e1', 'm2', '2026-06-01', 'dept-b'),
      person('e1', 'm1', '2026-01-01'),
    ]);

    expect(rows.managerEdges.filter((e) => e.engineerId === 'e1')).toEqual([
      {
        engineerId: 'e1',
        managerId: 'm1',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2026-06-01'),
      },
      { engineerId: 'e1', managerId: 'm2', validFrom: new Date('2026-06-01'), validTo: null },
    ]);
    expect(rows.engineers.find((e) => e.employeeId === 'e1')?.departmentId).toBe('dept-b');
    expect(rows.engineers).toHaveLength(4);
    expect(rows.orgUnits.map((u) => u.id)).toEqual(['dept-a', 'dept-b']);
  });

  it('gives the top of the tree no manager edge', () => {
    expect(orgRows([person('top', null, '2026-01-01')]).managerEdges).toEqual([]);
  });
});
