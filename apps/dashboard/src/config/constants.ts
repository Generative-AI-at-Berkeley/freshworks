/** Fixed values that are not configuration. Env lives in src/config/server.ts. */

export const APP_NAME = 'fwcoach';

export const ROUTES = {
  skills: '/skills',
  leaders: '/leaders',
  org: '/org',
  practice: '/practice',
  engineer: (engineerId: string) => `/engineers/${encodeURIComponent(engineerId)}`,
  leader: (managerId: string) => `/leaders/${encodeURIComponent(managerId)}`,
  skill: (skillId: string) => `/skills/${encodeURIComponent(skillId)}`,
} as const;

/** Browser-local preferences. Per-device UI state, never server state. */
export const STORAGE_KEYS = {
  theme: 'fwcoach.theme',
  sidebarCollapsed: 'fwcoach.sidebar-collapsed',
} as const;

/**
 * The browser's only way to the API: this app's own proxy route, which adds
 * the caller's identity server side. See src/app/api/v1/[...path]/route.ts.
 */
export const PROXY_PREFIX = '/api';

/** Default period for every view. The header's period control changes it per URL. */
export const DEFAULT_RANGE_DAYS = 28 as const;
