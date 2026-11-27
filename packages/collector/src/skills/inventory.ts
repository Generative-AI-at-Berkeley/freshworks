import type { Harness } from '@fwcoach/contracts';

/**
 * One skill installed on this machine (spec 6.4, P0). The same shape feeds
 * skill_dim on the backend, which de-duplicates across engineers by
 * contentHash plus id.
 */
export interface InstalledSkill {
  /** Stable across machines: plugin name plus skill name, for example "acme-plugin:review". */
  id: string;
  name: string;
  description: string | null;
  harness: Harness;
  scope: 'user' | 'workspace' | 'plugin';
  /** Plugin or marketplace it came from, when known. */
  plugin: string | null;
  /** SHA-256 of the skill's definition file. Lets the backend spot edited copies. */
  contentHash: string;
  /** Local only. Never uploaded: paths are content under the policy. */
  localPath: string;
  modifiedAt: string;
}

/**
 * Finds installed skills for one harness. What counts as a skill differs by
 * harness: Claude skills and plugin skills, Cursor rules, Kiro steering files
 * and Powers, and repo-level instruction files.
 *
 * TODO(AG-4): implement for every harness (P0). Start with Claude skills:
 * the spec calls them the biggest gap.
 * Works fully offline. Test against public skills installed on your own machine.
 */
export interface SkillScanner {
  readonly harness: Harness;
  scan(workspaceRoots: readonly string[]): Promise<InstalledSkill[]>;
}
