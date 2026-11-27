/**
 * A source of published skills to compare local usage against (spec 6.4, P1).
 * The Freshworks catalog is Git-backed and distributed through their internal
 * plugin marketplace. We build against a mock with the same manifest and
 * directory layout; the real location arrives as configuration.
 *
 * Lookups are triggered by a local signal (an unmatched prompt cluster, or an
 * installed skill with a newer catalog version), never by browsing.
 *
 * TODO(AG-4): implement MockMarketplaceCatalog against the layout Freshworks
 * shares. Put the mock catalog under packages/testkit/fixtures/marketplace/
 * (create it), synthetic names only.
 */
export interface CatalogEntry {
  id: string;
  name: string;
  plugin: string;
  version: string;
  description: string | null;
  publishedAt: string | null;
}

export interface CatalogProvider {
  readonly name: string;
  /** Hosts this provider may contact. Checked before every request; extend it, never remove it. */
  readonly allowedHosts: readonly string[];
  lookup(skillIds: readonly string[]): Promise<CatalogEntry[]>;
}
