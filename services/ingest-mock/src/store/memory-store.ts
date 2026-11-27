import type { DeliveryMessage } from '@fwcoach/contracts';

import type { EventStore, StoreResult } from './types.js';

/**
 * For unit tests. TODO(BE-1): PostgresEventStore. In one transaction, claim
 * each msg_id in the unpartitioned `app.ingest_msg` table with
 * `insert ... on conflict (msg_id) do nothing returning msg_id`, then insert
 * only the claimed events into the partitioned `app.event`. See
 * docs/data-model.md for why the dedupe key cannot live on `event` itself.
 */
export class MemoryEventStore implements EventStore {
  readonly messages = new Map<string, DeliveryMessage>();

  store(_deviceId: string, messages: readonly DeliveryMessage[]): Promise<StoreResult> {
    let inserted = 0;
    for (const message of messages) {
      if (this.messages.has(message.msg_id)) continue;
      this.messages.set(message.msg_id, message);
      inserted++;
    }
    return Promise.resolve({ inserted, duplicates: messages.length - inserted });
  }
}
