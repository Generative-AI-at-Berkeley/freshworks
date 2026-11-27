import type { DeliveryMessage } from '@fwcoach/contracts';

export interface StoreResult {
  inserted: number;
  /** Already stored under the same msg_id. Not an error: this is a retry. */
  duplicates: number;
}

/**
 * Where accepted events go. Idempotent on msg_id: storing the same message
 * twice keeps one copy and reports the second as a duplicate.
 */
export interface EventStore {
  store(deviceId: string, messages: readonly DeliveryMessage[]): Promise<StoreResult>;
}
