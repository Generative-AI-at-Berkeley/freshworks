import { ClaudeCodeAdapter } from './claude-code/index.js';
import { CursorAdapter } from './cursor/index.js';
import { KiroAdapter } from './kiro/index.js';
import type { HarnessAdapter } from './types.js';

// TODO(AG-3): Cursor Agent (the CLI) is its own harness per the spec. Add a
// CursorAgentAdapter here, sharing fixtures with CursorAdapter.
export function defaultAdapters(): HarnessAdapter[] {
  return [new ClaudeCodeAdapter(), new CursorAdapter(), new KiroAdapter()];
}
