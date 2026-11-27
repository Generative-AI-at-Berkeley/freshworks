/**
 * A small synthetic org for mock mode: one VP, three managers, six engineers.
 * Every name is invented. The repo is public, so nothing here may come from
 * the roster (AGENTS.md, Data).
 */

export interface MockPerson {
  id: string;
  name: string;
  orgUnitId: string;
  managerId: string | null;
}

export const ORG_UNITS = {
  'org-eng': 'Engineering',
  'org-platform': 'Platform',
  'org-payments': 'Payments',
  'org-mobile': 'Mobile',
} as const satisfies Record<string, string>;
export type OrgUnitId = keyof typeof ORG_UNITS;

export const PEOPLE: readonly MockPerson[] = [
  { id: 'e-100', name: 'Avery Stone', orgUnitId: 'org-eng', managerId: null },
  { id: 'e-110', name: 'Jordan Hale', orgUnitId: 'org-platform', managerId: 'e-100' },
  { id: 'e-111', name: 'Casey Moreau', orgUnitId: 'org-platform', managerId: 'e-110' },
  { id: 'e-112', name: 'Drew Okafor', orgUnitId: 'org-platform', managerId: 'e-110' },
  { id: 'e-120', name: 'Riley Novak', orgUnitId: 'org-payments', managerId: 'e-100' },
  { id: 'e-121', name: 'Jamie Lindqvist', orgUnitId: 'org-payments', managerId: 'e-120' },
  { id: 'e-122', name: 'Morgan Achebe', orgUnitId: 'org-payments', managerId: 'e-120' },
  { id: 'e-130', name: 'Sam Ferreira', orgUnitId: 'org-mobile', managerId: 'e-100' },
  { id: 'e-131', name: 'Taylor Ivanova', orgUnitId: 'org-mobile', managerId: 'e-130' },
  { id: 'e-132', name: 'Quinn Mbeki', orgUnitId: 'org-mobile', managerId: 'e-130' },
];

/** Who mock mode signs you in as: the VP, so every view has data. */
export const MOCK_VIEWER = { engineerId: 'e-100', orgUnitId: 'org-eng' } as const;

export function person(id: string): MockPerson | undefined {
  return PEOPLE.find((p) => p.id === id);
}

export function directReports(managerId: string): MockPerson[] {
  return PEOPLE.filter((p) => p.managerId === managerId).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function subtree(managerId: string): MockPerson[] {
  return directReports(managerId).flatMap((report) => [report, ...subtree(report.id)]);
}

export function isOrgUnitId(id: string): id is OrgUnitId {
  return Object.hasOwn(ORG_UNITS, id);
}
