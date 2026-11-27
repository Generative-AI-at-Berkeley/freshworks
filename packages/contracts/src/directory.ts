/**
 * One person from the HR directory, with the fields the backend needs
 * (spec 7.4). Lives in contracts because the directory sync (services/api)
 * and the synthetic org generator (packages/testkit) must produce the same
 * shape. Effective dates drive manager_edge, so a reorganisation adds rows
 * instead of rewriting old ones.
 *
 * `ssoSubject` and `departmentId` may be missing from a directory export.
 * Until that is settled, work email is the identity join key and a
 * cost-center-like grouping can stand in for department (docs/data-model.md).
 */
export interface DirectoryRecord {
  employeeId: string;
  ssoSubject: string | null;
  workEmail: string;
  displayName: string;
  departmentId: string;
  managerId: string | null;
  effectiveFrom: Date;
}
