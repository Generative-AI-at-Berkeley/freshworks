import { Harness } from '@fwcoach/contracts';

/** Display names for every harness. A new harness fails the type check here until it has one. */
export const HARNESS_LABEL: Record<Harness, string> = {
  [Harness.ClaudeCode]: 'Claude Code',
  [Harness.Cursor]: 'Cursor IDE',
  [Harness.CursorAgent]: 'Cursor Agent',
  [Harness.Kiro]: 'Kiro',
};

export function harnessLabel(harness: string): string {
  return harness in HARNESS_LABEL ? HARNESS_LABEL[harness as Harness] : harness;
}
