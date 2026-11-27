/**
 * Turns usage into cost without hiding where the number came from (ADR 0005).
 *
 * - Token prices are per model and token class, effective-dated.
 * - Credits are stored as credits. A credit rate is used only when one with a
 *   known source exists for that provider and date. Otherwise cost is null,
 *   and the API says so, rather than inventing a conversion.
 * - Self-hosted models are priced from a GPU-hour config.
 *
 * Changing a price recomputes rollups. It never rewrites raw events.
 *
 * TODO(BE-4): implement over the price_book table, with a default table
 * committed as a seed and overrides from organisation config.
 */
export const TokenClass = {
  Input: 'input',
  Output: 'output',
  CacheRead: 'cache_read',
  CacheWrite: 'cache_write',
} as const;
export type TokenClass = (typeof TokenClass)[keyof typeof TokenClass];

export type Usage =
  | { kind: 'tokens'; model: string; tokens: Partial<Record<TokenClass, number>> }
  | { kind: 'credits'; provider: string; credits: number }
  | { kind: 'gpu'; deployment: string; gpuSeconds: number };

export interface PricedUsage {
  /** Null when no reliable price exists. Never zero as a stand-in. */
  costUsd: number | null;
  /** The price_book row or config entry used, for example "anthropic-pricing-page". */
  source: string | null;
  effectiveFrom: Date | null;
  reason?: 'no_price_for_model' | 'no_credit_rate' | 'no_gpu_config';
}

export interface PriceBook {
  price(usage: Usage, at: Date): Promise<PricedUsage>;
}
