import { Harness } from '@fwcoach/contracts';

import type { CollectContext, CollectResult, DetectResult, HarnessAdapter } from '../types.js';

/**
 * TODO(AG-3): implement. Start with docs/formats/cursor.md: write down what
 * the harness stores and where, then build fixtures, then the parser.
 */
export class CursorAdapter implements HarnessAdapter {
  readonly harness = Harness.Cursor;

  detect(): Promise<DetectResult> {
    return Promise.resolve({ installed: false, formats: [], warnings: ['not implemented (AG-3)'] });
  }

  collect(ctx: CollectContext): Promise<CollectResult> {
    return Promise.resolve({ observations: [], cursor: ctx.since ?? {} });
  }
}
