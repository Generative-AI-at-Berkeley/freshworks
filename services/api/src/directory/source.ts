import type { DirectoryRecord } from '@fwcoach/contracts';

/**
 * Where people and reporting lines come from.
 *
 * TODO(BE-2): CsvDirectorySource for the CSV fallback the spec allows, and an
 * adapter over `generateOrg` from packages/testkit for tests and the demo.
 * The real HR integration arrives later as configuration.
 */
export interface DirectorySource {
  readonly name: string;
  records(): AsyncIterable<DirectoryRecord>;
}
