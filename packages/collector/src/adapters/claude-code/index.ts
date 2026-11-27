import { Harness } from '@fwcoach/contracts';

import type { CollectContext, CollectResult, DetectResult, HarnessAdapter } from '../types.js';

/**
 * TODO(AG-2): implement. Start with docs/formats/claude-code.md: write down what
 * the harness stores and where, then build fixtures, then the parser.
 */
export class ClaudeCodeAdapter implements HarnessAdapter {
  readonly harness = Harness.ClaudeCode;

  detect(): Promise<DetectResult> {
    return Promise.resolve({ installed: false, formats: [], warnings: ['not implemented (AG-2)'] });
  }

  collect(ctx: CollectContext): Promise<CollectResult> {
    return Promise.resolve({ observations: [], cursor: ctx.since ?? {} });
  }
}
