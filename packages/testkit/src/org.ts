import type { DirectoryRecord } from '@fwcoach/contracts';

/**
 * A synthetic org for tests and the demo. The spec's acceptance run needs at
 * least ten engineers across three departments and two management levels,
 * plus one reorg so effective dating is exercised.
 *
 * Generated data must be deterministic for a given seed, so a failing test
 * reproduces, and obviously fake (example.com, invented names) so it can never
 * be mistaken for, or mixed with, a real roster.
 *
 * TODO(BE-4): implement generateOrg. X-2 and the API integration tests both
 * build on it.
 */
export interface SyntheticOrgOptions {
  seed: number;
  departments: number;
  /** Management levels below the top leader. */
  levels: number;
  engineersPerTeam: number;
  /** Move one team to a new manager on this date, to test effective dating. */
  reorgOn?: Date;
}

/**
 * Same shape the directory sync produces. A person who changes manager in
 * the reorg appears twice, once per effective date.
 */
export type SyntheticPerson = DirectoryRecord;

export function generateOrg(_options: SyntheticOrgOptions): SyntheticPerson[] {
  throw new Error('generateOrg not implemented (BE-4)');
}
