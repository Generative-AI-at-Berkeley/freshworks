import { Harness } from '@fwcoach/contracts';

import type { CollectContext, CollectResult, DetectResult, HarnessAdapter } from '../types.js';

/**
 * TODO(AG-4): implement. Start with docs/formats/kiro.md: write down what
 * the harness stores and where, then build fixtures, then the parser.
 */
export class KiroAdapter implements HarnessAdapter {
  readonly harness = Harness.Kiro;

  detect(): Promise<DetectResult> {
    return Promise.resolve({ installed: false, formats: [], warnings: ['not implemented (AG-4)'] });
  }

  collect(ctx: CollectContext): Promise<CollectResult> {
    return Promise.resolve({ observations: [], cursor: ctx.since ?? {} });
  }
}
